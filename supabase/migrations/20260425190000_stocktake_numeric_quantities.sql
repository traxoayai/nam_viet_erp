-- Stocktake numeric quantities: keep fractional inventory adjustments intact.
-- Fixes:
--   1) inventory_batches / product_inventory / inventory_transactions quantities were INTEGER.
--   2) inventory_check_items actual/system/diff quantities were INTEGER.
--   3) complete_inventory_check and confirm_check_item_matching cast totals to INTEGER.
-- Date: 2026-04-25

BEGIN;

-- Convert storage columns first. Generated columns are recreated to avoid type-change issues.
ALTER TABLE public.inventory_check_items DROP COLUMN IF EXISTS diff_quantity;
ALTER TABLE public.inventory_check_items
  ALTER COLUMN system_quantity TYPE NUMERIC USING system_quantity::NUMERIC,
  ALTER COLUMN system_quantity SET DEFAULT 0,
  ALTER COLUMN actual_quantity TYPE NUMERIC USING actual_quantity::NUMERIC,
  ALTER COLUMN actual_quantity SET DEFAULT 0;
ALTER TABLE public.inventory_check_items
  ADD COLUMN diff_quantity NUMERIC GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED;

ALTER TABLE public.inventory_batches
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC,
  ALTER COLUMN quantity SET DEFAULT 0;

ALTER TABLE public.product_inventory
  ALTER COLUMN stock_quantity TYPE NUMERIC USING stock_quantity::NUMERIC,
  ALTER COLUMN stock_quantity SET DEFAULT 0;

ALTER TABLE public.inventory_transactions DROP COLUMN IF EXISTS total_value;
ALTER TABLE public.inventory_transactions
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;
ALTER TABLE public.inventory_transactions
  ADD COLUMN total_value NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED;

CREATE OR REPLACE FUNCTION public.confirm_check_item_matching(
    p_item_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item record;
    v_wh bigint;
    v_system_qty NUMERIC := 0;
BEGIN
    SELECT ci.*, ic.warehouse_id AS wh_id, ic.status AS check_status
    INTO v_item
    FROM public.inventory_check_items ci
    JOIN public.inventory_checks ic ON ic.id = ci.check_id
    WHERE ci.id = p_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Dòng kiểm kê không tồn tại');
    END IF;

    IF v_item.check_status IN ('COMPLETED', 'CANCELLED') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Phiếu đã khóa/hủy');
    END IF;

    v_wh := v_item.wh_id;

    IF v_item.batch_code IS NOT NULL AND btrim(v_item.batch_code) <> '' THEN
        SELECT COALESCE(ib.quantity, 0) INTO v_system_qty
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        WHERE ib.warehouse_id = v_wh
          AND ib.product_id = v_item.product_id
          AND b.batch_code = v_item.batch_code
        LIMIT 1;
    ELSE
        SELECT COALESCE(SUM(ib.quantity), 0) INTO v_system_qty
        FROM public.inventory_batches ib
        WHERE ib.warehouse_id = v_wh
          AND ib.product_id = v_item.product_id;
    END IF;

    UPDATE public.inventory_check_items
    SET
        actual_quantity = v_system_qty,
        system_quantity = v_system_qty,
        updated_at = NOW(),
        counted_by = auth.uid(),
        counted_at = NOW()
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Đã xác nhận khớp: ' || v_system_qty || ' ĐVCS',
        'actual_quantity', v_system_qty,
        'system_quantity', v_system_qty
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_check_item_matching(bigint)
    TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_inventory_check(p_check_id bigint, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_check_record RECORD;
    v_item RECORD;
    v_batch_id BIGINT;
    v_diff_qty NUMERIC;
    v_final_batch_code TEXT;
    v_final_expiry DATE;
    v_processed_count INT := 0;
    v_skipped_count INT := 0;
    v_remaining_to_deduct NUMERIC;
    v_target_batch RECORD;
    v_deduct_amount NUMERIC;
BEGIN
    SELECT * INTO v_check_record
    FROM public.inventory_checks
    WHERE id = p_check_id AND status = 'DRAFT'
    FOR UPDATE;

    IF v_check_record IS NULL THEN
        RAISE EXCEPTION 'Phiếu kiểm kê không hợp lệ hoặc đã được xử lý.';
    END IF;

    UPDATE public.inventory_check_items ci
    SET system_quantity = COALESCE(ib.quantity, 0)
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE ci.check_id = p_check_id
      AND ci.batch_code IS NOT NULL
      AND ci.batch_code != ''
      AND ib.warehouse_id = v_check_record.warehouse_id
      AND ib.product_id = ci.product_id
      AND b.batch_code = ci.batch_code;

    UPDATE public.inventory_check_items ci
    SET system_quantity = COALESCE(batch_sum.total, 0)
    FROM (
        SELECT ib.product_id, SUM(ib.quantity) as total
        FROM public.inventory_batches ib
        WHERE ib.warehouse_id = v_check_record.warehouse_id
        GROUP BY ib.product_id
    ) batch_sum
    WHERE ci.check_id = p_check_id
      AND (ci.batch_code IS NULL OR ci.batch_code = '')
      AND batch_sum.product_id = ci.product_id;

    UPDATE public.inventory_check_items ci
    SET system_quantity = 0
    WHERE ci.check_id = p_check_id
      AND ci.system_quantity IS NULL;

    UPDATE public.inventory_check_items ci
    SET system_quantity = 0
    WHERE ci.check_id = p_check_id
      AND ci.batch_code IS NOT NULL
      AND ci.batch_code != ''
      AND NOT EXISTS (
          SELECT 1 FROM public.inventory_batches ib
          JOIN public.batches b ON ib.batch_id = b.id
          WHERE ib.warehouse_id = v_check_record.warehouse_id
            AND ib.product_id = ci.product_id
            AND b.batch_code = ci.batch_code
      );

    UPDATE public.inventory_check_items ci
    SET system_quantity = 0
    WHERE ci.check_id = p_check_id
      AND (ci.batch_code IS NULL OR ci.batch_code = '')
      AND NOT EXISTS (
          SELECT 1 FROM public.inventory_batches ib
          WHERE ib.warehouse_id = v_check_record.warehouse_id
            AND ib.product_id = ci.product_id
            AND ib.quantity > 0
      );

    SELECT COUNT(*) INTO v_skipped_count
    FROM public.inventory_check_items
    WHERE check_id = p_check_id
      AND counted_at IS NULL;

    FOR v_item IN
        SELECT * FROM public.inventory_check_items
        WHERE check_id = p_check_id
          AND counted_at IS NOT NULL
    LOOP
        v_diff_qty := COALESCE(v_item.actual_quantity, 0) - COALESCE(v_item.system_quantity, 0);

        IF v_diff_qty > 0 THEN
            v_final_batch_code := COALESCE(NULLIF(TRIM(v_item.batch_code), ''), 'DEFAULT-ADJ-' || to_char(now(), 'YYMMDD'));
            v_final_expiry := COALESCE(v_item.expiry_date, CURRENT_DATE + 365);

            SELECT id INTO v_batch_id
            FROM public.batches
            WHERE product_id = v_item.product_id AND batch_code = v_final_batch_code
            LIMIT 1;

            IF v_batch_id IS NULL THEN
                INSERT INTO public.batches (product_id, batch_code, expiry_date, inbound_price, created_at)
                VALUES (v_item.product_id, v_final_batch_code, v_final_expiry, COALESCE(v_item.cost_price, 0), NOW())
                RETURNING id INTO v_batch_id;
            END IF;

            INSERT INTO public.inventory_batches (warehouse_id, product_id, batch_id, quantity, updated_at)
            VALUES (v_check_record.warehouse_id, v_item.product_id, v_batch_id, v_diff_qty, NOW())
            ON CONFLICT (warehouse_id, product_id, batch_id)
            DO UPDATE SET quantity = inventory_batches.quantity + EXCLUDED.quantity, updated_at = NOW();

            INSERT INTO public.inventory_transactions (warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, created_at, created_by)
            VALUES (v_check_record.warehouse_id, v_item.product_id, v_batch_id, 'in_adjust', 'ADJUST', v_diff_qty, COALESCE(v_item.cost_price, 0), v_check_record.code, 'Kiểm kê phát sinh thừa', NOW(), p_user_id);

        ELSIF v_diff_qty < 0 THEN
            v_remaining_to_deduct := ABS(v_diff_qty);

            IF v_item.batch_code IS NOT NULL AND v_item.batch_code != '' THEN
                SELECT ib.id, ib.batch_id, ib.quantity, b.inbound_price INTO v_target_batch
                FROM public.inventory_batches ib
                JOIN public.batches b ON ib.batch_id = b.id
                WHERE ib.warehouse_id = v_check_record.warehouse_id
                  AND ib.product_id = v_item.product_id
                  AND b.batch_code = v_item.batch_code
                LIMIT 1 FOR UPDATE;

                IF v_target_batch IS NOT NULL AND v_target_batch.quantity > 0 THEN
                    v_deduct_amount := LEAST(v_remaining_to_deduct, v_target_batch.quantity);

                    UPDATE public.inventory_batches
                    SET quantity = quantity - v_deduct_amount, updated_at = NOW()
                    WHERE id = v_target_batch.id;

                    INSERT INTO public.inventory_transactions (warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, created_at, created_by)
                    VALUES (v_check_record.warehouse_id, v_item.product_id, v_target_batch.batch_id, 'out_adjust', 'ADJUST', -v_deduct_amount, COALESCE(v_target_batch.inbound_price, v_item.cost_price, 0), v_check_record.code, 'Kiểm kê thất thoát', NOW(), p_user_id);

                    v_remaining_to_deduct := v_remaining_to_deduct - v_deduct_amount;
                END IF;
            END IF;

            IF v_remaining_to_deduct > 0 THEN
                FOR v_target_batch IN
                    SELECT ib.id, ib.batch_id, ib.quantity, b.inbound_price
                    FROM public.inventory_batches ib
                    JOIN public.batches b ON ib.batch_id = b.id
                    WHERE ib.warehouse_id = v_check_record.warehouse_id
                      AND ib.product_id = v_item.product_id
                      AND ib.quantity > 0
                    ORDER BY b.expiry_date ASC, b.created_at ASC
                    FOR UPDATE
                LOOP
                    EXIT WHEN v_remaining_to_deduct <= 0;
                    v_deduct_amount := LEAST(v_remaining_to_deduct, v_target_batch.quantity);

                    UPDATE public.inventory_batches
                    SET quantity = quantity - v_deduct_amount, updated_at = NOW()
                    WHERE id = v_target_batch.id;

                    INSERT INTO public.inventory_transactions (warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, created_at, created_by)
                    VALUES (v_check_record.warehouse_id, v_item.product_id, v_target_batch.batch_id, 'out_adjust', 'ADJUST', -v_deduct_amount, COALESCE(v_target_batch.inbound_price, v_item.cost_price, 0), v_check_record.code, 'Kiểm kê thất thoát (Bù trừ)', NOW(), p_user_id);

                    v_remaining_to_deduct := v_remaining_to_deduct - v_deduct_amount;
                END LOOP;
            END IF;
        END IF;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    UPDATE public.product_inventory pi
    SET stock_quantity = COALESCE(batch_sum.total, 0),
        updated_at = NOW()
    FROM (
        SELECT DISTINCT ci.product_id
        FROM public.inventory_check_items ci
        WHERE ci.check_id = p_check_id
    ) checked_products
    LEFT JOIN (
        SELECT ib.product_id, SUM(ib.quantity) as total
        FROM public.inventory_batches ib
        WHERE ib.warehouse_id = v_check_record.warehouse_id
        GROUP BY ib.product_id
    ) batch_sum ON checked_products.product_id = batch_sum.product_id
    WHERE pi.product_id = checked_products.product_id
      AND pi.warehouse_id = v_check_record.warehouse_id;

    UPDATE public.inventory_checks
    SET status = 'COMPLETED', verified_by = p_user_id, completed_at = NOW(), updated_at = NOW()
    WHERE id = p_check_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã chốt sổ kiểm kê thành công!',
        'items_processed', v_processed_count,
        'items_skipped', v_skipped_count
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
