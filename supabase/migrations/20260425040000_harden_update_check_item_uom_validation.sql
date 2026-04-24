-- Harden update_inventory_check_item_quantity: reject unknown UOM thay vì silent COALESCE=1
-- ============================================================================
-- Bug tiềm năng: Nếu SP không có row product_units type='wholesale' hoặc 'retail',
-- code cũ COALESCE rate về 1 → user nhập 5 "Hộp" nhưng SP thiếu wholesale unit:
-- v_total_base = 5 * 1 = 5 (sai, thực tế cần 5 * hệ số đúng).
-- UI thường load rate từ JOIN khi render → số hiển thị khác số lưu DB → silent corruption.
--
-- Fix: Khi user submit wholesale_qty > 0 (hoặc retail_qty > 0) mà SP thiếu
-- unit_type tương ứng → RAISE EXCEPTION với message rõ ràng, FE hiển thị lỗi.
-- Giữ nguyên toàn bộ logic khác (lot_number, expiry, system_qty refresh, UPDATE).
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_inventory_check_item_quantity(
    p_item_id bigint,
    p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item record;
    v_product_id bigint;
    v_wh bigint;
    v_wholesale_rate numeric;
    v_retail_rate numeric;
    v_input_wholesale numeric;
    v_input_retail numeric;
    v_input_base numeric;
    v_total_base_qty numeric;
    v_lot_number text;
    v_expiry_date date;
    v_system_qty int := 0;
    v_product_name text;
BEGIN
    SELECT ci.*, ic.warehouse_id AS wh_id
    INTO v_item
    FROM public.inventory_check_items ci
    JOIN public.inventory_checks ic ON ic.id = ci.check_id
    WHERE ci.id = p_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Dòng kiểm kê không tồn tại'
        );
    END IF;

    v_product_id := v_item.product_id;
    v_wh := v_item.wh_id;

    v_input_wholesale := COALESCE((p_payload->>'wholesale_qty')::numeric, 0);
    v_input_retail := COALESCE((p_payload->>'retail_qty')::numeric, 0);
    v_input_base := COALESCE((p_payload->>'base_qty')::numeric, 0);

    -- [FIX] Reject khi user nhập qty cho UOM không tồn tại trong product_units
    IF v_input_wholesale > 0 THEN
        SELECT conversion_rate INTO v_wholesale_rate
        FROM public.product_units
        WHERE product_id = v_product_id AND unit_type = 'wholesale'
        LIMIT 1;

        IF v_wholesale_rate IS NULL OR v_wholesale_rate <= 0 THEN
            SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;
            RAISE EXCEPTION 'Sản phẩm "%" chưa cấu hình đơn vị bán buôn. Cập nhật SP trước khi kiểm kê.',
                COALESCE(v_product_name, 'ID ' || v_product_id);
        END IF;
    ELSE
        v_wholesale_rate := 0; -- không dùng, nhưng tránh NULL arithmetic
    END IF;

    IF v_input_retail > 0 THEN
        SELECT conversion_rate INTO v_retail_rate
        FROM public.product_units
        WHERE product_id = v_product_id AND unit_type = 'retail'
        LIMIT 1;

        IF v_retail_rate IS NULL OR v_retail_rate <= 0 THEN
            SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;
            RAISE EXCEPTION 'Sản phẩm "%" chưa cấu hình đơn vị bán lẻ. Cập nhật SP trước khi kiểm kê.',
                COALESCE(v_product_name, 'ID ' || v_product_id);
        END IF;
    ELSE
        v_retail_rate := 0;
    END IF;

    v_total_base_qty :=
        (v_input_wholesale * COALESCE(v_wholesale_rate, 0))
        + (v_input_retail * COALESCE(v_retail_rate, 0))
        + v_input_base;

    IF p_payload ? 'lot_number' THEN
        v_lot_number := NULLIF(btrim(p_payload->>'lot_number'), '');
    ELSE
        v_lot_number := NULLIF(btrim(COALESCE(v_item.batch_code, '')), '');
    END IF;

    IF p_payload ? 'expiry_date'
       AND p_payload->>'expiry_date' IS NOT NULL
       AND p_payload->>'expiry_date' <> '' THEN
        BEGIN
            v_expiry_date := (p_payload->>'expiry_date')::date;
        EXCEPTION WHEN OTHERS THEN
            v_expiry_date := v_item.expiry_date;
        END;
    ELSE
        v_expiry_date := v_item.expiry_date;
    END IF;

    IF v_lot_number IS NOT NULL AND v_lot_number <> '' THEN
        SELECT COALESCE(ib.quantity, 0)::integer INTO v_system_qty
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        WHERE ib.warehouse_id = v_wh
          AND ib.product_id = v_product_id
          AND b.batch_code = v_lot_number
        LIMIT 1;
    ELSE
        SELECT COALESCE(SUM(ib.quantity), 0)::integer INTO v_system_qty
        FROM public.inventory_batches ib
        WHERE ib.warehouse_id = v_wh
          AND ib.product_id = v_product_id;
    END IF;

    UPDATE public.inventory_check_items
    SET
        actual_quantity = v_total_base_qty::integer,
        system_quantity = v_system_qty,
        batch_code = v_lot_number,
        expiry_date = v_expiry_date,
        updated_at = NOW(),
        counted_by = auth.uid(),
        counted_at = NOW()
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message',
        'Đã lưu: ' || v_total_base_qty || ' ĐVCS (Lô: ' || COALESCE(v_lot_number, 'tổng SP') || ')',
        'actual_quantity', v_total_base_qty,
        'system_quantity', v_system_qty
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
