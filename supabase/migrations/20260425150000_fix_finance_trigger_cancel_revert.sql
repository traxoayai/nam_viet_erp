-- Migration: auto_allocate_payment_to_orders — revert khi finance_transaction bị cancel
-- ============================================================================
-- BUG: Khi finance_transaction.status đổi từ 'completed' → 'cancelled', trigger
--      không revert paid_amount đã cộng vào orders → orders giữ paid_amount sai
--      (thừa) → payment_status='paid' dù tiền đã bị huỷ.
--
-- FIX: Thêm nhánh TG_OP='UPDATE' AND OLD.status='completed' AND NEW.status='cancelled':
--      - Tính lại paid_amount cho từng order liên quan (via ref_id hoặc partner).
--      - Trừ lại amount đã allocate từ finance_transaction bị cancel.
--      - Cập nhật payment_status theo paid_amount mới.
--
-- NOTE: Không có bảng order_payment_allocations trong schema. Dùng truy vấn
--       trực tiếp qua finance_transactions.ref_id → orders.code để tìm order
--       bị affect. Logic đảo ngược của nhánh INSERT/UPDATE completed.
--
-- Giữ nguyên toàn bộ logic cũ (FOR UPDATE lock, FIFO, ưu tiên ref_id).
-- Date: 2026-04-25
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
    -- Biến cho nhánh cancel revert
    v_cancel_amount NUMERIC;
    v_new_paid NUMERIC;
    v_new_payment_status TEXT;
BEGIN
    -- =====================================================================
    -- NHÁNH CANCEL REVERT: finance_transaction completed → cancelled
    -- Revert paid_amount cho order liên quan (ref_id trước, partner sau).
    -- =====================================================================
    IF TG_OP = 'UPDATE'
       AND OLD.status IN ('completed', 'confirmed')
       AND NEW.status = 'cancelled'
    THEN
        v_cancel_amount := OLD.amount;

        -- REVERT ƯU TIÊN 1: Đơn có ref_id khớp
        IF OLD.flow = 'in' AND OLD.ref_type = 'order' AND OLD.ref_id IS NOT NULL THEN
            v_ref_order_code := OLD.ref_id;

            FOR v_order IN
                SELECT id, final_amount, paid_amount, payment_status
                FROM public.orders
                WHERE (code = v_ref_order_code OR id::text = v_ref_order_code)
                  AND status != 'CANCELLED'
                FOR UPDATE
            LOOP
                -- Trừ tối đa bằng số đã allocate (không xuống dưới 0)
                v_pay_amount := LEAST(v_cancel_amount, COALESCE(v_order.paid_amount, 0));

                IF v_pay_amount > 0 THEN
                    v_new_paid := GREATEST(0, COALESCE(v_order.paid_amount, 0) - v_pay_amount);
                    v_new_payment_status := CASE
                        WHEN v_new_paid <= 0 THEN 'unpaid'
                        WHEN v_new_paid >= (v_order.final_amount - 100) THEN 'paid'
                        ELSE 'partial'
                    END;

                    UPDATE public.orders
                    SET
                        paid_amount    = v_new_paid,
                        payment_status = v_new_payment_status,
                        updated_at     = NOW()
                    WHERE id = v_order.id;

                    v_cancel_amount := v_cancel_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;

        -- REVERT ƯU TIÊN 2: Đơn nợ theo partner (LIFO order — đảo ngược FIFO allocate)
        IF v_cancel_amount > 0 AND OLD.flow = 'in'
           AND OLD.partner_type IN ('customer', 'customer_b2b')
        THEN
            BEGIN
                v_partner_id := OLD.partner_id::BIGINT;
            EXCEPTION WHEN OTHERS THEN
                RETURN NEW;
            END;

            FOR v_order IN
                SELECT id, final_amount, paid_amount, payment_status
                FROM public.orders
                WHERE
                    (
                        (OLD.partner_type = 'customer' AND customer_b2c_id = v_partner_id) OR
                        (OLD.partner_type = 'customer_b2b' AND customer_id = v_partner_id)
                    )
                    AND status != 'CANCELLED'
                    AND COALESCE(paid_amount, 0) > 0
                    AND (v_ref_order_code IS NULL OR (code != v_ref_order_code AND id::text != v_ref_order_code))
                ORDER BY created_at DESC  -- LIFO: revert order mới nhất trước (đảo ngược FIFO alloc)
                FOR UPDATE
            LOOP
                IF v_cancel_amount <= 0 THEN EXIT; END IF;

                v_pay_amount := LEAST(v_cancel_amount, COALESCE(v_order.paid_amount, 0));

                IF v_pay_amount > 0 THEN
                    v_new_paid := GREATEST(0, COALESCE(v_order.paid_amount, 0) - v_pay_amount);
                    v_new_payment_status := CASE
                        WHEN v_new_paid <= 0 THEN 'unpaid'
                        WHEN v_new_paid >= (v_order.final_amount - 100) THEN 'paid'
                        ELSE 'partial'
                    END;

                    UPDATE public.orders
                    SET
                        paid_amount    = v_new_paid,
                        payment_status = v_new_payment_status,
                        updated_at     = NOW()
                    WHERE id = v_order.id;

                    v_cancel_amount := v_cancel_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;

        RETURN NEW;
    END IF;

    -- =====================================================================
    -- NHÁNH ALLOCATE: INSERT hoặc UPDATE → completed/confirmed
    -- (Logic gốc từ 20260423200000_fix_payment_allocation_lock.sql)
    -- =====================================================================
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
