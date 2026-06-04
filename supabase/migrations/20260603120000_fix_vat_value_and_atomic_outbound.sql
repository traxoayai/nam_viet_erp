-- Fix VAT inventory value tracking + atomic outbound invoice
-- 2026-06-03
--
-- Sửa 3 lỗi của luồng "Đối chiếu hóa đơn VAT" (InvoiceVerifyPage):
--   B. process_vat_invoice_entry: trước đây không tìm thấy ĐVT thì âm thầm
--      gán conversion_rate = 1 -> nhập sai số lượng base. Nay RAISE chặn lại
--      (đối xứng với process_vat_export_entry vốn đã chặn).
--   A. process_vat_export_entry: trước đây chỉ trừ quantity_balance, KHÔNG trừ
--      total_value_balance -> sau khi xuất hết, giá trị tồn kho VAT đọng lại
--      "tiền ảo", sai báo cáo tài chính. Nay trừ giá trị theo GIÁ VỐN BÌNH QUÂN
--      GIA QUYỀN (phương pháp duy nhất khả thi vì ledger không lưu theo lô).
--   5. create_vat_outbound_invoice: gộp INSERT hóa đơn xuất + trừ kho vào MỘT
--      transaction. Thay cho flow cũ (frontend insert -> rpc -> nếu lỗi thì
--      delete), vốn để lại "hóa đơn ảo" verified_outbound chưa trừ kho nếu
--      request delete rớt mạng.
--
-- An toàn: chỉ CREATE OR REPLACE function (không ALTER bảng, không đổi cấu trúc).
-- LƯU Ý: migration này đụng logic TIỀN/TỒN trên prod — PHẢI test trên môi
-- trường staging (clone prod) trước khi apply. Chưa được verify tự động.

BEGIN;

-- =============================================================
-- B. NHẬP KHO VAT — chặn ĐVT không hợp lệ thay vì fallback = 1
--    (giữ nguyên toàn bộ logic cũ: cộng quantity_balance + total_value_balance)
-- =============================================================
CREATE OR REPLACE FUNCTION public.process_vat_invoice_entry(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_invoice_record RECORD;
    v_item JSONB;
    v_product_id BIGINT;
    v_unit_name TEXT;
    v_qty_input NUMERIC;
    v_vat_rate NUMERIC;
    v_unit_price NUMERIC;
    v_conversion_rate NUMERIC;
    v_qty_base NUMERIC;
    v_total_value NUMERIC;
    v_base_unit_name TEXT;
BEGIN
    SELECT * INTO v_invoice_record FROM public.finance_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hóa đơn ID % không tồn tại', p_invoice_id; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_invoice_record.items_json)
    LOOP
        v_product_id := (v_item->>'product_id')::BIGINT;
        v_unit_name  := v_item->>'internal_unit';
        v_qty_input  := COALESCE((v_item->>'quantity')::NUMERIC, 0);
        v_vat_rate   := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);
        v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);

        IF v_product_id IS NOT NULL AND v_qty_input > 0 THEN

            -- [LOGIC QUY ĐỔI] (giữ nguyên)
            v_conversion_rate := NULL;

            SELECT conversion_rate INTO v_conversion_rate
            FROM public.product_units
            WHERE product_id = v_product_id AND LOWER(unit_name) = LOWER(v_unit_name)
            LIMIT 1;

            IF v_conversion_rate IS NULL THEN
                 SELECT unit_name INTO v_base_unit_name
                 FROM public.product_units
                 WHERE product_id = v_product_id AND unit_type = 'base'
                 LIMIT 1;

                 IF LOWER(v_base_unit_name) = LOWER(v_unit_name) THEN
                    v_conversion_rate := 1;
                 END IF;
            END IF;

            -- [FIX lỗi B] Không tìm thấy tỷ lệ quy đổi -> CHẶN, không âm thầm = 1.
            IF v_conversion_rate IS NULL THEN
                RAISE EXCEPTION 'Không tìm thấy đơn vị "%" cho SP #% (Invoice #%). Kiểm tra lại cấu hình ĐVT của sản phẩm.',
                    v_unit_name, v_product_id, p_invoice_id;
            END IF;

            -- Tính toán
            v_qty_base    := v_qty_input * v_conversion_rate;
            v_total_value := v_qty_input * v_unit_price; -- Tổng giá trị = SL nhập * Đơn giá

            -- [UPSERT CỘNG KHO] (giữ nguyên)
            INSERT INTO public.vat_inventory_ledger (
                product_id, vat_rate, quantity_balance, total_value_balance, updated_at
            )
            VALUES (
                v_product_id, v_vat_rate, v_qty_base, v_total_value, NOW()
            )
            ON CONFLICT (product_id, vat_rate)
            DO UPDATE SET
                quantity_balance    = vat_inventory_ledger.quantity_balance + EXCLUDED.quantity_balance,
                total_value_balance = vat_inventory_ledger.total_value_balance + EXCLUDED.total_value_balance,
                updated_at = NOW();
        END IF;
    END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.process_vat_invoice_entry(bigint)
  IS 'Nhập kho VAT: cộng SL base + tổng giá trị. Chặn nếu ĐVT không tìm thấy (fix lỗi fallback rate=1).';


-- =============================================================
-- A. XUẤT KHO VAT — trừ cả total_value_balance theo bình quân gia quyền
--    (giữ nguyên toàn bộ validation strict + permission guard của bản cũ)
-- =============================================================
CREATE OR REPLACE FUNCTION public.process_vat_export_entry(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_item JSONB;
  v_product_id BIGINT;
  v_unit_name TEXT;
  v_qty_input NUMERIC;
  v_vat_rate NUMERIC;
  v_conversion_rate NUMERIC;
  v_qty_base NUMERIC;
  v_current_balance NUMERIC;
  v_current_value NUMERIC;   -- [FIX lỗi A] giá trị tồn hiện tại
  v_value_deduct NUMERIC;    -- [FIX lỗi A] giá trị cần trừ (bình quân)
BEGIN
  -- 0. Permission guard
  PERFORM public.check_rpc_access('process_vat_export_entry');

  -- 1. Get invoice
  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- 2. Loop through raw_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_invoice.raw_items, '[]'::JSONB))
  LOOP
    v_qty_input := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    IF v_qty_input <= 0 THEN CONTINUE; END IF;

    -- Strict unit validation: no fallback default
    v_unit_name := COALESCE(NULLIF(TRIM(v_item->>'unit'), ''), NULLIF(TRIM(v_item->>'internal_unit'), ''));
    IF v_unit_name IS NULL THEN
      RAISE EXCEPTION 'Item thieu don vi tinh (unit). Invoice #%', p_invoice_id;
    END IF;

    v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);

    -- Mandatory product_id: no name-based fallback
    v_product_id := (v_item->>'product_id')::BIGINT;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Item thieu product_id. Invoice #%, item: %', p_invoice_id, v_item->>'product_name';
    END IF;

    -- Find conversion rate
    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit_name
    LIMIT 1;
    IF v_conversion_rate IS NULL THEN
      RAISE EXCEPTION 'Khong tim thay don vi "%" cho SP #%. Invoice #%',
        v_unit_name, v_product_id, p_invoice_id;
    END IF;

    v_qty_base := v_qty_input * v_conversion_rate;

    -- Check VAT inventory (with FOR UPDATE lock) — lấy thêm total_value_balance
    SELECT quantity_balance, total_value_balance
      INTO v_current_balance, v_current_value
    FROM public.vat_inventory_ledger
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate
    FOR UPDATE;

    IF NOT FOUND OR v_current_balance < v_qty_base THEN
      RAISE EXCEPTION 'Khong du kho VAT cho SP #% (VAT %): Can %, Ton %',
        v_product_id, v_vat_rate, v_qty_base, COALESCE(v_current_balance, 0);
    END IF;

    -- [FIX lỗi A] Trừ GIÁ TRỊ tồn theo giá vốn BÌNH QUÂN GIA QUYỀN.
    -- giá vốn đơn vị = total_value_balance / quantity_balance (trước khi trừ).
    -- Xuất hết (v_qty_base = v_current_balance) => giá trị tồn về 0, hết "tiền ảo".
    IF v_current_balance > 0 THEN
      v_value_deduct := v_current_value * (v_qty_base / v_current_balance);
    ELSE
      v_value_deduct := 0;
    END IF;

    -- Deduct (cả số lượng và giá trị)
    UPDATE public.vat_inventory_ledger
    SET quantity_balance    = quantity_balance - v_qty_base,
        total_value_balance = GREATEST(total_value_balance - v_value_deduct, 0),
        updated_at = NOW()
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.process_vat_export_entry(bigint)
  IS 'Xuất kho VAT: trừ SL base + giá trị tồn (bình quân gia quyền). Fix: trước đây quên trừ total_value_balance.';


-- =============================================================
-- 5. TẠO HÓA ĐƠN XUẤT VAT ATOMIC — insert + trừ kho trong 1 transaction
-- =============================================================
CREATE OR REPLACE FUNCTION public.create_vat_outbound_invoice(p_payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  PERFORM public.check_rpc_access('create_vat_outbound_invoice');

  INSERT INTO public.finance_invoices (
    invoice_number, invoice_symbol, invoice_date, supplier_name_raw,
    buyer_tax_code, total_amount_pre_tax, tax_amount, total_amount_post_tax,
    direction, status, raw_items, created_at
  ) VALUES (
    p_payload->>'invoice_number',
    p_payload->>'invoice_symbol',
    NULLIF(p_payload->>'invoice_date', '')::date,
    p_payload->>'supplier_name_raw',
    p_payload->>'buyer_tax_code',
    COALESCE((p_payload->>'total_amount_pre_tax')::numeric, 0),
    COALESCE((p_payload->>'total_tax')::numeric, 0),
    COALESCE((p_payload->>'total_amount_post_tax')::numeric, 0),
    'outbound',
    'verified_outbound',
    p_payload->'items',
    NOW()
  )
  RETURNING id INTO v_id;

  -- Cùng transaction: nếu trừ kho RAISE (thiếu hàng / ĐVT sai) thì INSERT phía
  -- trên tự ROLLBACK. Không còn hóa đơn "ảo" chưa trừ kho như flow cũ.
  PERFORM public.process_vat_export_entry(v_id);

  RETURN v_id;
END;
$function$;

ALTER FUNCTION public.create_vat_outbound_invoice(jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_vat_outbound_invoice(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_vat_outbound_invoice(jsonb)
  IS 'Tạo HĐ xuất VAT + trừ kho trong 1 transaction (atomic). Thay flow insert->rpc->delete dễ để lại HĐ ảo.';

-- Đăng ký quyền RPC (đồng bộ với process_vat_export_entry: finance.view_balance)
INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('create_vat_outbound_invoice', 'finance.view_balance', 20, true, 'Tạo HĐ xuất VAT + trừ kho atomic')
ON CONFLICT (function_name) DO UPDATE SET
  required_permission  = EXCLUDED.required_permission,
  max_calls_per_minute = EXCLUDED.max_calls_per_minute,
  is_write             = EXCLUDED.is_write,
  description          = EXCLUDED.description;


-- =============================================================
-- INBOUND ATOMIC — verify + nhập kho trong 1 transaction
-- =============================================================
-- Trước đây: frontend UPDATE status='verified' (đã commit) rồi mới gọi RPC nhập
-- kho ở request RIÊNG. Nếu nhập kho RAISE (vd ĐVT sai sau fix lỗi B) thì hóa đơn
-- đã "verified" nhưng kho chưa nhập -> lệch. Nay gộp set-verified + nhập kho vào
-- 1 transaction: nhập kho lỗi thì status tự rollback về draft.
CREATE OR REPLACE FUNCTION public.verify_and_process_vat_invoice(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  PERFORM public.check_rpc_access('verify_and_process_vat_invoice');

  SELECT status INTO v_status
  FROM public.finance_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- Đã verified rồi -> không nhập kho lần 2 (idempotent)
  IF v_status = 'verified' THEN
    RETURN;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Không thể verify: Hóa đơn đang ở trạng thái "%"', v_status;
  END IF;

  UPDATE public.finance_invoices SET status = 'verified' WHERE id = p_invoice_id;

  -- Cùng transaction: nhập kho lỗi -> rollback set verified ở trên.
  PERFORM public.process_vat_invoice_entry(p_invoice_id);
END;
$function$;

ALTER FUNCTION public.verify_and_process_vat_invoice(bigint) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.verify_and_process_vat_invoice(bigint) TO authenticated, service_role;

COMMENT ON FUNCTION public.verify_and_process_vat_invoice(bigint)
  IS 'Verify HĐ nhập + nhập kho VAT atomic (1 transaction). Idempotent nếu đã verified.';

INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('verify_and_process_vat_invoice', 'finance.view_balance', 30, true, 'Verify + nhập kho VAT atomic')
ON CONFLICT (function_name) DO UPDATE SET
  required_permission  = EXCLUDED.required_permission,
  max_calls_per_minute = EXCLUDED.max_calls_per_minute,
  is_write             = EXCLUDED.is_write,
  description          = EXCLUDED.description;

COMMIT;
