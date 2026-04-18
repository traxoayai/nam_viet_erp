-- Migration: Tự động chuyển status PENDING -> CONFIRMED khi thanh toán đủ
-- ============================================================================
-- GOAL:
--   1. Khi khách chuyển khoản đủ tiền, đơn hàng từ 'PENDING' tự chuyển sang 'CONFIRMED'.
--   2. Khi chuyển sang 'CONFIRMED', trigger 'orders_deduct_on_confirm' sẽ tự trừ kho FEFO.
--   3. Đồng nhất flow: PORTAL (PENDING) -> FINANCE (PAID) -> ORDER (CONFIRMED) -> STOCK (DEDUCTED).
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

COMMIT;
