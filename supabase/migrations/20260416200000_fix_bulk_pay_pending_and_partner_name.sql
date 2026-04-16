-- Fix: bulk_pay_orders tao phieu thu voi status='completed' ngay lap tuc
-- => Thu Quy khong kiem soat duoc tien
-- Fix: thieu partner_name_cache => hien thi "Khach le" thay vi ten Quay thuoc
-- 2026-04-16

BEGIN;

-- =====================================================================
-- 1. Fix bulk_pay_orders: status 'pending' + partner_name_cache
-- =====================================================================
CREATE OR REPLACE FUNCTION "public"."bulk_pay_orders"(
    "p_order_ids" "uuid"[],
    "p_fund_account_id" bigint,
    "p_note" "text" DEFAULT 'Thanh toán hàng loạt'::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_amount_to_pay NUMERIC;
    v_batch_code TEXT;
    v_success_count INT := 0;
    v_partner_name TEXT;
BEGIN
    -- 1. TAO MA LO GOC (Format: PT-260214-Bxxxx -> B la Batch)
    v_batch_code := 'PT-' || to_char(NOW(), 'YYMMDD') || '-B' || LPAD(floor(random() * 10000)::text, 4, '0');

    -- 2. Vong lap qua tung ID don hang
    FOR v_order IN
        SELECT o.id, o.code, o.final_amount, o.paid_amount, o.customer_id,
               COALESCE(c.name, 'Khách B2B') AS customer_name
        FROM public.orders o
        LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
        WHERE o.id = ANY(p_order_ids)
          AND o.payment_status != 'paid'
          AND o.status NOT IN ('DRAFT', 'CANCELLED', 'QUOTE', 'QUOTE_EXPIRED')
    LOOP
        v_amount_to_pay := v_order.final_amount - COALESCE(v_order.paid_amount, 0);

        IF v_amount_to_pay > 0 THEN
            v_success_count := v_success_count + 1;
            v_partner_name := v_order.customer_name;

            -- Insert Phieu thu le voi status='pending' de Thu Quy duyet
            INSERT INTO public.finance_transactions (
                code, transaction_date, flow, business_type, amount, fund_account_id,
                partner_type, partner_id, partner_name_cache,
                ref_type, ref_id, description, status, created_by
            ) VALUES (
                v_batch_code || '-' || v_success_count::text,
                NOW(), 'in', 'trade', v_amount_to_pay, p_fund_account_id,
                'customer_b2b', v_order.customer_id::text, v_partner_name,
                'order', v_order.code::text,
                p_note || ' (' || v_partner_name || ' - Mã Đơn: ' || v_order.code || ')',
                'pending', auth.uid()
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'batch_code', v_batch_code,
        'processed_count', v_success_count,
        'message', 'Đã tạo ' || v_success_count || ' phiếu thu chờ duyệt (Lô ' || v_batch_code || ')'
    );
END;
$$;

-- =====================================================================
-- 2. Fix data cu: cap nhat partner_name_cache cho phieu thu batch da tao
--    (Nhung phieu co code bat dau bang 'PT-' va chua '-B' => batch)
-- =====================================================================
UPDATE public.finance_transactions ft
SET partner_name_cache = c.name
FROM public.orders o
JOIN public.customers_b2b c ON o.customer_id = c.id
WHERE ft.partner_name_cache IS NULL
  AND ft.code LIKE 'PT-%-B%'
  AND ft.ref_type = 'order'
  AND ft.partner_type = 'customer_b2b'
  AND (o.code = ft.ref_id OR o.id::text = ft.ref_id);

COMMIT;
