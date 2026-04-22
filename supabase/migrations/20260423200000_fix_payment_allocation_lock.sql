-- Migration: Fix race condition trong auto_allocate_payment_to_orders
-- ============================================================================
-- BUG (Data Integrity P0 — Task 3):
--   Function public.auto_allocate_payment_to_orders() (trigger AFTER
--   INSERT/UPDATE trên finance_transactions) có 2 FOR loop đọc rồi update
--   orders.paid_amount + status nhưng KHÔNG khóa row → 2 finance_transactions
--   đến đồng thời (vd: webhook ngân hàng retry, hoặc webhook + admin confirm
--   manual) cùng đọc paid_amount cũ, cùng cộng, ghi đè lẫn nhau → lost update
--   → tổng paid_amount SAI → khách bị ghi nhận thiếu → gạch nợ sai.
--
-- FIX:
--   Thêm FOR UPDATE vào cuối SELECT của 2 FOR loop để pessimistic lock từng
--   order đang được allocate. Pattern chuẩn tham khảo từ Odoo
--   account.payment reconciliation (with_for_update()) và SAP B1 JDT1 row
--   lock. Postgres sẽ block transaction thứ 2 tại SELECT đến khi transaction
--   thứ nhất COMMIT, đảm bảo serialized update.
--
-- Giữ NGUYÊN 100% logic cũ (CTEs, điều kiện, thứ tự ưu tiên FIFO). Chỉ thêm
-- FOR UPDATE. Không refactor, không đổi hành vi khác.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION "public"."auto_allocate_payment_to_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_remaining_amount NUMERIC;
    v_order RECORD;
    v_pay_amount NUMERIC;
    v_partner_id BIGINT;
    v_ref_order_code TEXT;
BEGIN
    -- Chỉ chạy khi flow='in' (Thu tiền) và status Completed/Confirmed
    IF NEW.flow = 'in'
       AND NEW.status IN ('completed', 'confirmed')
       AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('completed', 'confirmed'))
    THEN
        v_remaining_amount := NEW.amount;

        -- ƯU TIÊN 1: TRẢ CHO ĐÚNG ĐƠN HÀNG (Nếu có ref_id)
        IF NEW.ref_type = 'order' AND NEW.ref_id IS NOT NULL THEN
            v_ref_order_code := NEW.ref_id;

            FOR v_order IN
                SELECT id, final_amount, paid_amount, status, code
                FROM public.orders
                WHERE (code = v_ref_order_code OR id::text = v_ref_order_code)
                  AND payment_status != 'paid'
                  AND status != 'CANCELLED'
                FOR UPDATE
            LOOP
                v_pay_amount := LEAST(v_remaining_amount, v_order.final_amount - COALESCE(v_order.paid_amount, 0));

                IF v_pay_amount > 0 THEN
                    UPDATE public.orders
                    SET
                        paid_amount = COALESCE(paid_amount, 0) + v_pay_amount,
                        payment_status = CASE
                            WHEN (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'paid'
                            ELSE 'partial'
                        END,
                        -- Cập nhật status sang CONFIRMED nếu là đơn PENDING và đã trả đủ
                        status = CASE
                            WHEN status = 'PENDING' AND (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'CONFIRMED'
                            ELSE status
                        END,
                        updated_at = NOW()
                    WHERE id = v_order.id;

                    v_remaining_amount := v_remaining_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;

        -- ƯU TIÊN 2: TRẢ NỢ CŨ (FIFO)
        IF v_remaining_amount > 0 AND NEW.partner_type IN ('customer', 'customer_b2b') THEN
            BEGIN
                v_partner_id := NEW.partner_id::BIGINT;
            EXCEPTION WHEN OTHERS THEN
                RETURN NEW;
            END;

            FOR v_order IN
                SELECT id, final_amount, paid_amount, status
                FROM public.orders
                WHERE
                    (
                        (NEW.partner_type = 'customer' AND customer_b2c_id = v_partner_id) OR
                        (NEW.partner_type = 'customer_b2b' AND customer_id = v_partner_id)
                    )
                    AND payment_status != 'paid'
                    AND status != 'CANCELLED'
                    AND (v_ref_order_code IS NULL OR (code != v_ref_order_code AND id::text != v_ref_order_code))
                ORDER BY created_at ASC
                FOR UPDATE
            LOOP
                IF v_remaining_amount <= 0 THEN EXIT; END IF;

                v_pay_amount := LEAST(v_remaining_amount, v_order.final_amount - COALESCE(v_order.paid_amount, 0));

                IF v_pay_amount > 0 THEN
                    UPDATE public.orders
                    SET
                        paid_amount = COALESCE(paid_amount, 0) + v_pay_amount,
                        payment_status = CASE
                            WHEN (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'paid'
                            ELSE 'partial'
                        END,
                        -- Cập nhật status sang CONFIRMED nếu là đơn PENDING và đã trả đủ
                        status = CASE
                            WHEN status = 'PENDING' AND (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'CONFIRMED'
                            ELSE status
                        END,
                        updated_at = NOW()
                    WHERE id = v_order.id;

                    v_remaining_amount := v_remaining_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
