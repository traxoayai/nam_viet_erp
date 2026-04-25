-- Hardening bulk_pay_orders:
-- 1. check_rpc_access guard
-- 2. advisory lock theo partner_id (customer_id)
-- 3. Dùng _gen_finance_tx_code thay RANDOM 4 digits (tránh collision)
-- 2026-04-25

BEGIN;

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
    -- 1. ACCESS GUARD
    PERFORM public.check_rpc_access('bulk_pay_orders');

    -- 2. ADVISORY LOCK: khoá theo tập order_ids (hash toàn bộ mảng text)
    --    Dùng ANY customer_id từ danh sách — lấy customer_id đầu tiên làm seed
    --    để ngăn 2 request cùng batch cho cùng 1 khách chạy song song.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            'bulk-pay-' || COALESCE(
                (SELECT o.customer_id::text FROM public.orders o
                 WHERE o.id = ANY(p_order_ids) LIMIT 1),
                ''::text
            ),
            0
        )
    );

    -- 3. GEN MÃ LÔ dùng sequence-based helper (tránh collision)
    --    Format: PT-YYMMDD-NNNNNNRR-B (B = Batch)
    v_batch_code := public._gen_finance_tx_code('PT') || '-B';

    -- 4. Vòng lặp qua từng ID đơn hàng
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

            -- Insert phiếu thu lẻ với status='pending' để Thu Quỹ duyệt
            INSERT INTO public.finance_transactions (
                code, transaction_date, flow, business_type, amount, fund_account_id,
                partner_type, partner_id, partner_name_cache,
                ref_type, ref_id, description, status, created_by
            ) VALUES (
                v_batch_code || LPAD(v_success_count::text, 3, '0'),
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

NOTIFY pgrst, 'reload schema';

COMMIT;
