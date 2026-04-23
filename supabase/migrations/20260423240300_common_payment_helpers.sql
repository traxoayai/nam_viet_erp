-- Common-hóa R1 + R2: SQL helper functions
-- ============================================================================
-- R1: _resolve_order_partner(order_id uuid) RETURNS partner_type/id/name
--     — pattern "customer_id vs customer_b2c_id" lặp 4+ nơi.
-- R2: _insert_order_payment_tx(...) helper insert finance_transactions với
--     pattern chuẩn (gen code, fallback fund, partner lookup).
--
-- Bước tiếp theo (KHÔNG làm trong migration này): refactor callers sang dùng
-- helper. Giữ trong nhánh separate để diff dễ review. Hiện tại CHỈ define
-- helper (đọc-only, idempotent), không động vào caller.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- R1: partner resolver — shared logic giữa bank parser / manual RPC / notify
CREATE OR REPLACE FUNCTION public._resolve_order_partner(p_order_id uuid)
RETURNS TABLE(
  partner_type TEXT,
  partner_id TEXT,
  partner_name TEXT
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN o.customer_id IS NOT NULL THEN 'customer_b2b'
      ELSE 'customer'
    END AS partner_type,
    COALESCE(o.customer_id::text, o.customer_b2c_id::text) AS partner_id,
    COALESCE(cb.name, cc.name, 'Khách lẻ') AS partner_name
  FROM public.orders o
  LEFT JOIN public.customers_b2b cb ON cb.id = o.customer_id
  LEFT JOIN public.customers cc ON cc.id = o.customer_b2c_id
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public._resolve_order_partner(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public._resolve_order_partner(uuid) IS
  'Helper: trả partner_type/id/name từ orders.customer_id vs customer_b2c_id. Dùng trong bank parser, manual payment RPC, notification trigger.';

-- R2: Insert order payment tx helper
-- Params đầy đủ để caller control description + status + bank_ref + idempotency
CREATE OR REPLACE FUNCTION public._insert_order_payment_tx(
  p_order_id uuid,
  p_amount numeric,
  p_description text,
  p_bank_ref text DEFAULT NULL,
  p_status text DEFAULT 'completed'
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_partner RECORD;
  v_fund_id BIGINT;
  v_trans_code TEXT;
BEGIN
  SELECT id, code INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % không tồn tại', p_order_id;
  END IF;

  SELECT * INTO v_partner FROM public._resolve_order_partner(p_order_id);

  SELECT id INTO v_fund_id
  FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.finance_transactions (
    code, amount, flow, business_type, fund_account_id,
    partner_type, partner_id, partner_name_cache,
    ref_type, ref_id, description, status, bank_reference_id
  ) VALUES (
    v_trans_code, p_amount, 'in', 'trade', v_fund_id,
    v_partner.partner_type, v_partner.partner_id, v_partner.partner_name,
    'order', v_order.code,
    p_description, p_status, p_bank_ref
  );

  RETURN v_trans_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public._insert_order_payment_tx(uuid, numeric, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public._insert_order_payment_tx(uuid, numeric, text, text, text) IS
  'Helper: insert finance_transactions cho thanh toán 1 đơn. Gen code + fund_id fallback + partner lookup tự động. Caller control description, status, bank_ref. Chỉ service_role (tránh Portal user tự gọi).';

COMMIT;
