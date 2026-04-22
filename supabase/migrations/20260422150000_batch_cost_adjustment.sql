-- Batch Cost Adjustment / Revaluation
-- 2026-04-22
-- - Table: batch_revaluations (audit trail)
-- - RPC: get_batch_valuation_grid, get_inventory_total_value, bulk_update_batch_costs
-- - RPC `bulk_update_batch_costs` sync `vat_inventory_ledger.total_value_balance`
--   theo tỉ lệ qty/vat_rate để không làm lệch sổ cái tồn kho VAT.
--
-- An toàn: additive-only, idempotent. Không ALTER bảng cũ.

BEGIN;

-- =============================================================
-- 1. AUDIT TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.batch_revaluations (
  id            BIGSERIAL PRIMARY KEY,
  batch_id      BIGINT NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  product_id    BIGINT NOT NULL REFERENCES public.products(id),
  warehouse_id  BIGINT REFERENCES public.warehouses(id),
  old_price     NUMERIC NOT NULL,
  new_price     NUMERIC NOT NULL,
  qty_at_change INTEGER NOT NULL,
  delta_value   NUMERIC GENERATED ALWAYS AS (qty_at_change * (new_price - old_price)) STORED,
  reason_code   TEXT NOT NULL CHECK (reason_code IN ('data_fix','supplier_adjust','nrv_writedown')),
  note          TEXT,
  vat_synced    BOOLEAN NOT NULL DEFAULT false,
  user_id       UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_revaluations_batch    ON public.batch_revaluations(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_revaluations_product  ON public.batch_revaluations(product_id);
CREATE INDEX IF NOT EXISTS idx_batch_revaluations_created  ON public.batch_revaluations(created_at DESC);

ALTER TABLE public.batch_revaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batch_revaluations_read" ON public.batch_revaluations;
CREATE POLICY "batch_revaluations_read" ON public.batch_revaluations
  FOR SELECT TO authenticated USING (true);
-- Ghi chỉ qua RPC SECURITY DEFINER; không cần INSERT/UPDATE policy.

GRANT SELECT ON public.batch_revaluations TO authenticated;
GRANT ALL ON public.batch_revaluations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.batch_revaluations_id_seq TO authenticated, service_role;

COMMENT ON TABLE public.batch_revaluations IS 'Audit trail cho mọi lần điều chỉnh giá vốn theo lô (batches.inbound_price)';


-- =============================================================
-- 2. RPC: get_batch_valuation_grid
-- =============================================================
--   Trả về grid: 1 dòng = 1 (batch, warehouse) đang có tồn > 0 (hoặc filter
--   chỉ lô thiếu giá nếu p_only_missing_price = true).
--   Sắp xếp: HSD tăng dần, SP theo tên.

CREATE OR REPLACE FUNCTION public.get_batch_valuation_grid(
    p_warehouse_id         BIGINT  DEFAULT NULL,
    p_search               TEXT    DEFAULT '',
    p_only_missing_price   BOOLEAN DEFAULT false,
    p_limit                INT     DEFAULT 50,
    p_offset               INT     DEFAULT 0
)
RETURNS TABLE (
    inventory_batch_id  BIGINT,
    batch_id            BIGINT,
    product_id          BIGINT,
    sku                 TEXT,
    product_name        TEXT,
    warehouse_id        BIGINT,
    warehouse_name      TEXT,
    lot_number          TEXT,
    expiry_date         DATE,
    quantity            INTEGER,
    inbound_price       NUMERIC,
    total_value         NUMERIC,
    last_revalued_at    TIMESTAMPTZ,
    total_count         BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT
            ib.id                         AS inventory_batch_id,
            b.id                          AS batch_id,
            p.id                          AS product_id,
            p.sku                         AS sku,
            p.name                        AS product_name,
            ib.warehouse_id               AS warehouse_id,
            w.name                        AS warehouse_name,
            b.batch_code                  AS lot_number,
            b.expiry_date                 AS expiry_date,
            ib.quantity::integer          AS quantity,
            COALESCE(b.inbound_price, 0)  AS inbound_price,
            (ib.quantity * COALESCE(b.inbound_price, 0))::numeric AS total_value,
            (SELECT MAX(br.created_at) FROM public.batch_revaluations br WHERE br.batch_id = b.id) AS last_revalued_at
        FROM public.inventory_batches ib
        JOIN public.batches  b ON b.id = ib.batch_id
        JOIN public.products p ON p.id = ib.product_id
        LEFT JOIN public.warehouses w ON w.id = ib.warehouse_id
        WHERE ib.quantity > 0
          AND (p_warehouse_id IS NULL OR ib.warehouse_id = p_warehouse_id)
          AND (NOT p_only_missing_price OR COALESCE(b.inbound_price, 0) = 0)
          AND (
                COALESCE(p_search, '') = ''
                OR p.name       ILIKE '%' || p_search || '%'
                OR p.sku        ILIKE '%' || p_search || '%'
                OR b.batch_code ILIKE '%' || p_search || '%'
          )
    )
    SELECT
        base.*,
        (SELECT COUNT(*) FROM base) AS total_count
    FROM base
    ORDER BY base.expiry_date ASC NULLS LAST, base.product_name ASC, base.batch_id ASC
    LIMIT  GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0);
END;
$$;

ALTER FUNCTION public.get_batch_valuation_grid(BIGINT, TEXT, BOOLEAN, INT, INT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_batch_valuation_grid(BIGINT, TEXT, BOOLEAN, INT, INT) TO authenticated, service_role;


-- =============================================================
-- 3. RPC: get_inventory_total_value
-- =============================================================
-- Trả về thống kê tổng cho header.

CREATE OR REPLACE FUNCTION public.get_inventory_total_value(
    p_warehouse_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT jsonb_build_object(
        'total_value',                COALESCE(SUM(ib.quantity * COALESCE(b.inbound_price, 0)), 0),
        'total_qty',                  COALESCE(SUM(ib.quantity), 0),
        'count_batches',              COUNT(*) FILTER (WHERE ib.quantity > 0),
        'count_zero_price_batches',   COUNT(*) FILTER (WHERE ib.quantity > 0 AND COALESCE(b.inbound_price, 0) = 0)
    )
    FROM public.inventory_batches ib
    JOIN public.batches b ON b.id = ib.batch_id
    WHERE ib.quantity > 0
      AND (p_warehouse_id IS NULL OR ib.warehouse_id = p_warehouse_id);
$$;

ALTER FUNCTION public.get_inventory_total_value(BIGINT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_inventory_total_value(BIGINT) TO authenticated, service_role;


-- =============================================================
-- 4. RPC: bulk_update_batch_costs
-- =============================================================
-- Input p_changes: [{"batch_id": 123, "new_price": 25000}, ...]
--       p_reason:  'data_fix' | 'supplier_adjust' | 'nrv_writedown'
--       p_note:    optional text
--
-- Logic (trong 1 transaction):
--   1. Validate input
--   2. FOR mỗi change:
--      a. Lock row batches, lấy old_price
--      b. Skip nếu old_price == new_price
--      c. Tính qty_at_change = Σ inventory_batches.quantity (toàn hệ thống)
--      d. INSERT batch_revaluations (old/new/qty/reason/note/user)
--      e. UPDATE batches.inbound_price = new_price
--      f. SYNC vat_inventory_ledger.total_value_balance theo tỉ lệ qty/vat_rate
--         của product đó trong ledger. Nếu không có dòng nào, vat_synced=false.
--   3. Return summary.

CREATE OR REPLACE FUNCTION public.bulk_update_batch_costs(
    p_changes JSONB,
    p_reason  TEXT,
    p_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id          UUID;
    v_change           JSONB;
    v_batch_id         BIGINT;
    v_new_price        NUMERIC;
    v_old_price        NUMERIC;
    v_product_id       BIGINT;
    v_qty_at_change    INTEGER;
    v_delta_per_unit   NUMERIC;
    v_ledger_total_qty NUMERIC;
    v_revaluation_id   BIGINT;
    v_revaluation_ids  BIGINT[] := ARRAY[]::BIGINT[];
    v_updated_count    INT := 0;
    v_skipped_count    INT := 0;
    v_vat_synced       BOOLEAN;
BEGIN
    -- 0. Auth & guard
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: chưa đăng nhập';
    END IF;

    IF p_reason IS NULL OR p_reason NOT IN ('data_fix','supplier_adjust','nrv_writedown') THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Thiếu hoặc sai reason_code. Hợp lệ: data_fix | supplier_adjust | nrv_writedown'
        );
    END IF;

    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array' OR jsonb_array_length(p_changes) = 0 THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Danh sách thay đổi rỗng'
        );
    END IF;

    -- 1. Loop từng change
    FOR v_change IN SELECT * FROM jsonb_array_elements(p_changes)
    LOOP
        v_batch_id  := (v_change->>'batch_id')::BIGINT;
        v_new_price := (v_change->>'new_price')::NUMERIC;

        IF v_batch_id IS NULL OR v_new_price IS NULL OR v_new_price < 0 THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- 1a. Lock row batches + lấy giá cũ + product_id
        SELECT b.inbound_price, b.product_id
          INTO v_old_price, v_product_id
        FROM public.batches b
        WHERE b.id = v_batch_id
        FOR UPDATE;

        IF NOT FOUND THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        v_old_price := COALESCE(v_old_price, 0);

        -- 1b. Skip nếu giá không đổi
        IF v_old_price = v_new_price THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- 1c. Tổng tồn của lô tại mọi kho (snapshot cho audit)
        SELECT COALESCE(SUM(ib.quantity), 0)::INTEGER
          INTO v_qty_at_change
        FROM public.inventory_batches ib
        WHERE ib.batch_id = v_batch_id;

        -- 1d. Sync vat_inventory_ledger nếu có dòng cho product đó
        v_vat_synced := false;

        SELECT COALESCE(SUM(l.quantity_balance), 0)
          INTO v_ledger_total_qty
        FROM public.vat_inventory_ledger l
        WHERE l.product_id = v_product_id AND l.quantity_balance > 0;

        IF v_ledger_total_qty > 0 AND v_qty_at_change > 0 THEN
            v_delta_per_unit := v_new_price - v_old_price;

            -- Phân bổ delta theo tỉ lệ qty từng vat_rate
            UPDATE public.vat_inventory_ledger l
            SET total_value_balance = l.total_value_balance
                                    + (v_qty_at_change * v_delta_per_unit)
                                      * (l.quantity_balance::NUMERIC / v_ledger_total_qty),
                updated_at = NOW()
            WHERE l.product_id = v_product_id
              AND l.quantity_balance > 0;

            v_vat_synced := true;
        END IF;

        -- 1e. INSERT audit
        INSERT INTO public.batch_revaluations (
            batch_id, product_id, warehouse_id,
            old_price, new_price, qty_at_change,
            reason_code, note, vat_synced, user_id
        ) VALUES (
            v_batch_id, v_product_id, NULL,
            v_old_price, v_new_price, v_qty_at_change,
            p_reason, p_note, v_vat_synced, v_user_id
        )
        RETURNING id INTO v_revaluation_id;

        v_revaluation_ids := array_append(v_revaluation_ids, v_revaluation_id);

        -- 1f. UPDATE giá mới
        UPDATE public.batches
        SET inbound_price = v_new_price
        WHERE id = v_batch_id;

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'updated_count', v_updated_count,
        'skipped_count', v_skipped_count,
        'revaluation_ids', to_jsonb(v_revaluation_ids)
    );
END;
$$;

ALTER FUNCTION public.bulk_update_batch_costs(JSONB, TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.bulk_update_batch_costs(JSONB, TEXT, TEXT) TO authenticated, service_role;


-- =============================================================
-- 5. rpc_access_rules
-- =============================================================

INSERT INTO public.rpc_access_rules (
    function_name, required_permission, max_calls_per_minute, is_write, description
) VALUES
    ('get_batch_valuation_grid',   NULL, 120, false, 'Grid lô + tồn + giá vốn cho màn Điều chỉnh Giá Vốn'),
    ('get_inventory_total_value',  NULL,  60, false, 'Tổng giá trị tồn kho theo inbound_price lô'),
    ('bulk_update_batch_costs',    NULL,  20, true,  'Điều chỉnh giá vốn hàng loạt theo lô + audit + sync VAT ledger')
ON CONFLICT (function_name) DO UPDATE SET
    required_permission  = EXCLUDED.required_permission,
    max_calls_per_minute = EXCLUDED.max_calls_per_minute,
    is_write             = EXCLUDED.is_write,
    description          = EXCLUDED.description;

COMMIT;
