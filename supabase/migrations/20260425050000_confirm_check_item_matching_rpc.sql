-- RPC confirm_check_item_matching: set actual_quantity = system_quantity, mark counted
-- ============================================================================
-- Backend support cho nút "Đủ/OK" trên UI kiểm kê. Trước đây nút này chỉ moveNext
-- client-side, không commit → finalize xuất trắng kho (bug 4/2026).
--
-- Semantics: user xác nhận tồn thực tế KHỚP với tồn máy → không cần gõ số, chỉ
-- cần flag đã đếm. Backend refresh system_quantity từ inventory_batches mới nhất,
-- set actual = system, counted_at = NOW(), counted_by = auth.uid().
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

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
    v_system_qty int := 0;
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

    -- Refresh system_quantity: dùng batch_code nếu có, ngược lại SUM all
    IF v_item.batch_code IS NOT NULL AND btrim(v_item.batch_code) <> '' THEN
        SELECT COALESCE(ib.quantity, 0)::integer INTO v_system_qty
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        WHERE ib.warehouse_id = v_wh
          AND ib.product_id = v_item.product_id
          AND b.batch_code = v_item.batch_code
        LIMIT 1;
    ELSE
        SELECT COALESCE(SUM(ib.quantity), 0)::integer INTO v_system_qty
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

INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('confirm_check_item_matching', NULL, 120, true, 'Xác nhận dòng kiểm kê khớp tồn máy')
ON CONFLICT (function_name) DO UPDATE SET
    required_permission = EXCLUDED.required_permission,
    max_calls_per_minute = EXCLUDED.max_calls_per_minute,
    is_write = EXCLUDED.is_write,
    description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
COMMIT;
