-- Stocktake (kiểm kê chủ động): thêm SP vào phiếu theo từng lô + đồng bộ system_quantity khi cập nhật dòng
-- 2026-04-21

BEGIN;

-- Batches cho kiểm kê: gồm mọi lô có tồn > 0 (kể cả hết hạn — vẫn phải đếm được)
CREATE OR REPLACE FUNCTION public.search_product_batches_for_stocktake(
    p_product_id bigint,
    p_warehouse_id bigint
)
RETURNS TABLE (
    inventory_batch_id bigint,
    lot_number text,
    expiry_date date,
    quantity integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT
        ib.id AS inventory_batch_id,
        b.batch_code AS lot_number,
        b.expiry_date,
        ib.quantity::integer
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE ib.product_id = p_product_id
      AND ib.warehouse_id = p_warehouse_id
      AND ib.quantity > 0
    ORDER BY b.expiry_date ASC NULLS LAST, b.id ASC;
$$;

ALTER FUNCTION public.search_product_batches_for_stocktake(bigint, bigint) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.search_product_batches_for_stocktake(bigint, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.search_product_batches_for_stocktake(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_product_batches_for_stocktake(bigint, bigint) TO service_role;


CREATE OR REPLACE FUNCTION public.add_item_to_check_session(
    p_check_id bigint,
    p_product_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_warehouse_id bigint;
    v_check_status text;
    v_user_id uuid;
    v_cost_price numeric;
    v_location text;
    v_pi_qty numeric;
    v_new_id bigint;
    v_batch record;
    v_has_batches boolean := false;
    v_inserted_ids bigint[] := ARRAY[]::bigint[];
    v_first_existing_id bigint;
BEGIN
    v_user_id := auth.uid();

    SELECT warehouse_id, status
    INTO v_warehouse_id, v_check_status
    FROM public.inventory_checks
    WHERE id = p_check_id;

    IF v_warehouse_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Phiếu kiểm kê không tồn tại'
        );
    END IF;

    IF v_check_status IN ('COMPLETED', 'CANCELLED') THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Không thể thêm vào phiếu đã khóa/hủy'
        );
    END IF;

    SELECT COALESCE(actual_cost, 0)
    INTO v_cost_price
    FROM public.products
    WHERE id = p_product_id;

    SELECT
        COALESCE(stock_quantity, 0),
        (
            COALESCE(NULLIF(location_cabinet, '') || '-', '')
            || COALESCE(NULLIF(location_row, '') || '-', '')
            || COALESCE(location_slot, '')
        )
    INTO v_pi_qty, v_location
    FROM public.product_inventory
    WHERE warehouse_id = v_warehouse_id AND product_id = p_product_id;

    v_location := COALESCE(NULLIF(btrim(v_location), ''), 'Chưa xếp vị trí');
    v_pi_qty := COALESCE(v_pi_qty, 0);

    SELECT EXISTS (
        SELECT 1
        FROM public.inventory_batches ib
        WHERE ib.warehouse_id = v_warehouse_id
          AND ib.product_id = p_product_id
          AND ib.quantity > 0
    ) INTO v_has_batches;

    IF v_has_batches THEN
        IF EXISTS (
            SELECT 1
            FROM public.inventory_check_items ci
            WHERE ci.check_id = p_check_id
              AND ci.product_id = p_product_id
              AND (ci.batch_code IS NULL OR btrim(ci.batch_code) = '')
              AND (
                  COALESCE(ci.actual_quantity, 0) <> 0
                  OR ci.counted_at IS NOT NULL
              )
        ) THEN
            RETURN jsonb_build_object(
                'status', 'error',
                'message',
                'Sản phẩm đang có dòng kiểm kê tổng đã nhập số liệu. Xóa dòng đó trước khi thêm theo từng lô.'
            );
        END IF;

        DELETE FROM public.inventory_check_items ci
        WHERE ci.check_id = p_check_id
          AND ci.product_id = p_product_id
          AND (ci.batch_code IS NULL OR btrim(ci.batch_code) = '');

        FOR v_batch IN
            SELECT b.batch_code AS bc, b.expiry_date AS exp, ib.quantity AS qty
            FROM public.inventory_batches ib
            JOIN public.batches b ON ib.batch_id = b.id
            WHERE ib.warehouse_id = v_warehouse_id
              AND ib.product_id = p_product_id
              AND ib.quantity > 0
            ORDER BY b.expiry_date ASC NULLS LAST, b.id ASC
        LOOP
            IF EXISTS (
                SELECT 1
                FROM public.inventory_check_items x
                WHERE x.check_id = p_check_id
                  AND x.product_id = p_product_id
                  AND x.batch_code IS NOT DISTINCT FROM v_batch.bc
            ) THEN
                CONTINUE;
            END IF;

            INSERT INTO public.inventory_check_items (
                check_id,
                product_id,
                batch_code,
                expiry_date,
                system_quantity,
                actual_quantity,
                cost_price,
                location_snapshot,
                created_at,
                updated_at,
                created_by,
                counted_by,
                counted_at
            ) VALUES (
                p_check_id,
                p_product_id,
                v_batch.bc,
                v_batch.exp,
                LEAST(
                    GREATEST(v_batch.qty::integer, 0),
                    2147483647
                ),
                0,
                COALESCE(v_cost_price, 0),
                v_location,
                NOW(),
                NOW(),
                v_user_id,
                NULL,
                NULL
            )
            RETURNING id INTO v_new_id;

            v_inserted_ids := array_append(v_inserted_ids, v_new_id);
        END LOOP;

        IF cardinality(v_inserted_ids) > 0 THEN
            UPDATE public.inventory_checks SET updated_at = NOW() WHERE id = p_check_id;
            RETURN jsonb_build_object(
                'status', 'success',
                'item_id', v_inserted_ids[1],
                'item_ids', to_jsonb(v_inserted_ids),
                'inserted_count', cardinality(v_inserted_ids),
                'message', 'Đã thêm sản phẩm vào phiếu kiểm kê'
            );
        END IF;

        SELECT id INTO v_first_existing_id
        FROM public.inventory_check_items
        WHERE check_id = p_check_id AND product_id = p_product_id
        ORDER BY id ASC
        LIMIT 1;

        RETURN jsonb_build_object(
            'status', 'exists',
            'item_id', v_first_existing_id,
            'message', 'Tất cả lô của sản phẩm đã có trên phiếu'
        );
    END IF;

    -- Không có lô tồn > 0: một dòng tổng (hành vi cũ)
    SELECT id INTO v_first_existing_id
    FROM public.inventory_check_items
    WHERE check_id = p_check_id AND product_id = p_product_id
    LIMIT 1;

    IF v_first_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'exists',
            'item_id', v_first_existing_id,
            'message', 'Sản phẩm này đã có trong phiếu'
        );
    END IF;

    INSERT INTO public.inventory_check_items (
        check_id,
        product_id,
        batch_code,
        expiry_date,
        system_quantity,
        actual_quantity,
        cost_price,
        location_snapshot,
        created_at,
        updated_at,
        created_by,
        counted_by,
        counted_at
    ) VALUES (
        p_check_id,
        p_product_id,
        NULL,
        NULL,
        LEAST(GREATEST(v_pi_qty::integer, 0), 2147483647),
        0,
        COALESCE(v_cost_price, 0),
        v_location,
        NOW(),
        NOW(),
        v_user_id,
        NULL,
        NULL
    )
    RETURNING id INTO v_new_id;

    UPDATE public.inventory_checks SET updated_at = NOW() WHERE id = p_check_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'item_id', v_new_id,
        'item_ids', jsonb_build_array(v_new_id),
        'inserted_count', 1,
        'message', 'Đã thêm sản phẩm vào phiếu kiểm kê'
    );
END;
$$;

ALTER FUNCTION public.add_item_to_check_session(bigint, bigint) OWNER TO postgres;


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
    v_wholesale_rate int := 1;
    v_retail_rate int := 1;
    v_input_wholesale numeric;
    v_input_retail numeric;
    v_input_base numeric;
    v_total_base_qty numeric;
    v_lot_number text;
    v_expiry_date date;
    v_system_qty int := 0;
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

    SELECT conversion_rate INTO v_wholesale_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_type = 'wholesale'
    LIMIT 1;

    SELECT conversion_rate INTO v_retail_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_type = 'retail'
    LIMIT 1;

    v_wholesale_rate := COALESCE(v_wholesale_rate, 1);
    v_retail_rate := COALESCE(v_retail_rate, 1);

    v_total_base_qty :=
        (v_input_wholesale * v_wholesale_rate)
        + (v_input_retail * v_retail_rate)
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

ALTER FUNCTION public.update_inventory_check_item_quantity(bigint, jsonb) OWNER TO postgres;


-- Dòng dùng khi phát sinh thừa / lô mới (system = 0, không gắn lô sẵn)
CREATE OR REPLACE FUNCTION public.add_surplus_stocktake_line(
    p_check_id bigint,
    p_product_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_warehouse_id bigint;
    v_check_status text;
    v_user_id uuid;
    v_cost_price numeric;
    v_new_id bigint;
BEGIN
    v_user_id := auth.uid();

    SELECT warehouse_id, status
    INTO v_warehouse_id, v_check_status
    FROM public.inventory_checks
    WHERE id = p_check_id;

    IF v_warehouse_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Phiếu kiểm kê không tồn tại'
        );
    END IF;

    IF v_check_status IN ('COMPLETED', 'CANCELLED') THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Không thể thêm dòng vào phiếu đã khóa/hủy'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Sản phẩm không tồn tại'
        );
    END IF;

    SELECT COALESCE(actual_cost, 0) INTO v_cost_price
    FROM public.products
    WHERE id = p_product_id;

    INSERT INTO public.inventory_check_items (
        check_id,
        product_id,
        batch_code,
        expiry_date,
        system_quantity,
        actual_quantity,
        cost_price,
        location_snapshot,
        created_at,
        updated_at,
        created_by,
        counted_by,
        counted_at
    ) VALUES (
        p_check_id,
        p_product_id,
        NULL,
        NULL,
        0,
        0,
        COALESCE(v_cost_price, 0),
        'Thừa hàng / lô mới (nhập số lô khi đếm)',
        NOW(),
        NOW(),
        v_user_id,
        NULL,
        NULL
    )
    RETURNING id INTO v_new_id;

    UPDATE public.inventory_checks SET updated_at = NOW() WHERE id = p_check_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'id', v_new_id,
        'item_id', v_new_id,
        'message', 'Đã thêm dòng thừa hàng — nhập số lô và số lượng thực tế'
    );
END;
$$;

ALTER FUNCTION public.add_surplus_stocktake_line(bigint, bigint) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.add_surplus_stocktake_line(bigint, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.add_surplus_stocktake_line(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_surplus_stocktake_line(bigint, bigint) TO service_role;

INSERT INTO public.rpc_access_rules (
    function_name,
    required_permission,
    max_calls_per_minute,
    is_write,
    description
) VALUES
    (
        'search_product_batches_for_stocktake',
        NULL,
        120,
        false,
        'Danh sách lô theo SP/kho cho kiểm kê'
    ),
    (
        'add_surplus_stocktake_line',
        NULL,
        20,
        true,
        'Thêm dòng thừa hàng / lô mới trên phiếu kiểm kê'
    ),
    (
        'add_item_to_check_session',
        NULL,
        30,
        true,
        'Thêm sản phẩm (theo lô) vào phiếu kiểm kê'
    ),
    (
        'update_inventory_check_item_quantity',
        NULL,
        60,
        true,
        'Cập nhật số lượng kiểm kê từng dòng'
    )
ON CONFLICT (function_name) DO UPDATE SET
    required_permission = EXCLUDED.required_permission,
    max_calls_per_minute = EXCLUDED.max_calls_per_minute,
    is_write = EXCLUDED.is_write,
    description = EXCLUDED.description;

COMMIT;
