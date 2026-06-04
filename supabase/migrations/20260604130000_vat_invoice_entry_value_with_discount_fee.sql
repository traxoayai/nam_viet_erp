-- R1: process_vat_invoice_entry tính GIÁ VỐN tồn kho VAT đúng chuẩn VAS.
-- Ngày 2026-06-04. Phụ thuộc migration 20260604120000 (cột finance_invoices.total_fee_amount).
--
-- TRƯỚC: total_value cộng vào kho = qty * unit_price (SAI khi có chiết khấu / phí).
-- SAU:   total_value = amount_before_tax (thành tiền SAU chiết khấu, lấy từ item, fallback
--        qty*price - discount_amount) + phần PHÍ phân bổ theo tỷ trọng Thành tiền từng dòng
--        / tổng Thành tiền hóa đơn (chuẩn VAS — user xác nhận 2026-06-04).
-- GIỮ NGUYÊN: logic quy đổi conversion_rate + RAISE khi sai ĐVT (fix lỗi B trước đó),
--        upsert vat_inventory_ledger, SECURITY DEFINER, signature.
-- Phân bổ phí: 2-pass. Pass 1 tính tổng Thành tiền (mẫu số). Pass 2 phân bổ; dòng CUỐI
--        ôm phần dư để SUM(phí phân bổ) = total_fee_amount tuyệt đối (tránh lệch do làm tròn).

BEGIN;

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
    -- [VAS] thành tiền sau CK + phân bổ phí
    v_line_value NUMERIC;        -- amount_before_tax của dòng
    v_total_goods NUMERIC := 0;  -- tổng amount_before_tax (mẫu số phân bổ phí)
    v_total_fee NUMERIC := 0;    -- tổng phí mua hàng (cột mới)
    v_fee_allocated NUMERIC := 0;-- phí đã phân bổ (để dòng cuối ôm phần dư)
    v_item_count INT := 0;       -- số dòng hợp lệ
    v_idx INT := 0;              -- thứ tự dòng hợp lệ
    v_allocated_fee NUMERIC;
BEGIN
    SELECT * INTO v_invoice_record FROM public.finance_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hóa đơn ID % không tồn tại', p_invoice_id; END IF;

    v_total_fee := COALESCE(v_invoice_record.total_fee_amount, 0);

    -- PASS 1: tổng Thành tiền (sau CK) + đếm dòng hợp lệ — làm mẫu số phân bổ phí.
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_invoice_record.items_json)
    LOOP
        IF (v_item->>'product_id') IS NOT NULL
           AND COALESCE((v_item->>'quantity')::NUMERIC, 0) > 0 THEN
            v_total_goods := v_total_goods + COALESCE(
                (v_item->>'amount_before_tax')::NUMERIC,
                COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0)
                  - COALESCE((v_item->>'discount_amount')::NUMERIC, 0)
            );
            v_item_count := v_item_count + 1;
        END IF;
    END LOOP;

    -- PASS 2: quy đổi + cộng kho theo giá vốn đúng.
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

            -- [GIỮ fix lỗi B] sai ĐVT -> CHẶN, không âm thầm = 1.
            IF v_conversion_rate IS NULL THEN
                RAISE EXCEPTION 'Không tìm thấy đơn vị "%" cho SP #% (Invoice #%). Kiểm tra lại cấu hình ĐVT của sản phẩm.',
                    v_unit_name, v_product_id, p_invoice_id;
            END IF;

            v_qty_base := v_qty_input * v_conversion_rate;

            -- [VAS] Thành tiền sau CK của dòng (ưu tiên amount_before_tax từ XML)
            v_line_value := COALESCE(
                (v_item->>'amount_before_tax')::NUMERIC,
                (v_qty_input * v_unit_price) - COALESCE((v_item->>'discount_amount')::NUMERIC, 0)
            );

            -- [VAS] Phân bổ phí theo tỷ trọng Thành tiền; dòng cuối ôm phần dư.
            v_idx := v_idx + 1;
            IF v_total_fee > 0 AND v_total_goods > 0 THEN
                IF v_idx >= v_item_count THEN
                    v_allocated_fee := v_total_fee - v_fee_allocated;
                ELSE
                    v_allocated_fee := ROUND(v_total_fee * (v_line_value / v_total_goods));
                    v_fee_allocated := v_fee_allocated + v_allocated_fee;
                END IF;
            ELSE
                v_allocated_fee := 0;
            END IF;

            -- Giá vốn nhập kho = Thành tiền sau CK + phí phân bổ (KHÔNG phải qty*price)
            v_total_value := v_line_value + v_allocated_fee;

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
  IS 'Nhập kho VAT (VAS): giá vốn = Thành tiền sau CK (amount_before_tax) + phí phân bổ theo tỷ trọng. Chặn nếu ĐVT không tìm thấy.';

COMMIT;
