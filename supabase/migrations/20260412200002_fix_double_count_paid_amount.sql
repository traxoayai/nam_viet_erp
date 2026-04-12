-- Fix: Double-counting paid_amount
-- Nguyen nhan: 2 triggers trg_auto_sync_order_payment + trg_auto_allocate_payment
-- deu += paid_amount khi finance_transactions INSERT => paid_amount gap doi
-- Fix: Bo paid_amount/payment_status ra khoi trigger_sync_order_payment,
-- chi giu remittance_* va logic cancel. De auto_allocate_payment xu ly paid_amount.
-- 2026-04-12

BEGIN;

-- =====================================================================
-- 1. Fix trigger_sync_order_payment: chi giu remittance + cancel logic
-- =====================================================================
CREATE OR REPLACE FUNCTION "public"."trigger_sync_order_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- [CASE 1] KHI PHIEU THU DUOC DUYET (Pending -> Completed)
    -- HOAC TAO MOI O TRANG THAI COMPLETED NGAY LAP TUC
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN

        -- Chi xu ly phieu Thu (flow='in') va loai tham chieu la Don hang (ref_type='order')
        IF NEW.flow = 'in' AND NEW.ref_type = 'order' THEN

            -- Chi cap nhat remittance info (KHONG cap nhat paid_amount - de cho auto_allocate_payment)
            UPDATE public.orders
            SET
                remittance_transaction_id = NEW.id,
                remittance_status = 'deposited',
                updated_at = NOW()
            WHERE code = NEW.ref_id;

        END IF;
    END IF;

    -- [CASE 2] KHI HUY PHIEU THU DA DUYET (Completed -> Cancelled)
    -- Tru lai tien va reset trang thai neu lo duyet sai
    IF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

        IF NEW.flow = 'in' AND NEW.ref_type = 'order' THEN
            UPDATE public.orders
            SET
                -- Tru so tien cua phieu bi huy (Khong cho phep am)
                paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - OLD.amount),

                -- Go thong tin doi soat cua phieu nay
                remittance_transaction_id = NULL,
                remittance_status = 'pending',

                -- Tinh lai trang thai thanh toan dua tren so tien con lai
                payment_status = CASE
                    WHEN (GREATEST(0, COALESCE(paid_amount, 0) - OLD.amount)) >= final_amount THEN 'paid'
                    WHEN (GREATEST(0, COALESCE(paid_amount, 0) - OLD.amount)) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END,

                updated_at = NOW()
            WHERE code = NEW.ref_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================================
-- 2. Fix data production: paid_amount bi gap doi
-- Tinh lai paid_amount = tong amount cua cac finance_transactions completed
-- =====================================================================
UPDATE public.orders o
SET
    paid_amount = sub.correct_paid,
    payment_status = CASE
        WHEN sub.correct_paid >= o.final_amount THEN 'paid'
        WHEN sub.correct_paid > 0 THEN 'partial'
        ELSE 'unpaid'
    END
FROM (
    SELECT
        ft.ref_id AS order_code,
        SUM(ft.amount) AS correct_paid
    FROM public.finance_transactions ft
    WHERE ft.flow = 'in'
      AND ft.ref_type = 'order'
      AND ft.status = 'completed'
    GROUP BY ft.ref_id
) sub
WHERE o.code = sub.order_code
  AND o.paid_amount != sub.correct_paid;

COMMIT;
