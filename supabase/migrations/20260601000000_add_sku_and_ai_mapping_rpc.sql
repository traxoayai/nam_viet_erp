-- Migration: add_sku_and_ai_mapping_rpc
-- Description: Add supplier_sku to vendor_product_mappings and create map_scanned_invoice_products RPC

-- 1. Thêm cột supplier_sku (nếu chưa có)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendor_product_mappings' AND column_name='supplier_sku') THEN
        ALTER TABLE vendor_product_mappings ADD COLUMN supplier_sku text;
    END IF;
END $$;

-- 2. Tạo Type trả về cho RPC (giúp định nghĩa cấu trúc trả về rõ ràng)
DO $$ BEGIN
    CREATE TYPE mapped_invoice_product AS (
        supplier_sku text,
        vendor_product_name text,
        unit text,
        quantity numeric,
        unit_price numeric,
        lot text,
        expiry text,
        internal_product_id bigint,
        internal_product_name text,
        match_score numeric,
        match_method text
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tạo RPC map_scanned_invoice_products
-- Nhận vào p_vendor_id và mảng p_items dạng JSON: 
-- [{ sku, name, unit, quantity, unit_price, lot, expiry }, ...]
CREATE OR REPLACE FUNCTION map_scanned_invoice_products(p_vendor_id bigint, p_items jsonb)
RETURNS SETOF mapped_invoice_product
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    v_sku text;
    v_name text;
    v_unit text;
    v_qty numeric;
    v_price numeric;
    v_lot text;
    v_expiry text;
    
    v_internal_id bigint;
    v_internal_name text;
    v_score numeric;
    v_method text;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sku := trim(item->>'sku');
        v_name := trim(item->>'name');
        v_unit := trim(item->>'unit');
        v_qty := (item->>'quantity')::numeric;
        v_price := (item->>'unit_price')::numeric;
        v_lot := trim(item->>'lot');
        v_expiry := trim(item->>'expiry');
        
        v_internal_id := NULL;
        v_internal_name := NULL;
        v_score := 0;
        v_method := NULL;

        -- Cách 1: Tìm chính xác theo supplier_sku
        IF v_sku IS NOT NULL AND v_sku != '' THEN
            SELECT m.internal_product_id, p.name
            INTO v_internal_id, v_internal_name
            FROM vendor_product_mappings m
            JOIN products p ON p.id = m.internal_product_id
            WHERE m.vendor_id = p_vendor_id 
              AND m.supplier_sku = v_sku 
            LIMIT 1;
            
            IF FOUND THEN
                v_method := 'Exact SKU';
                v_score := 1.0;
            END IF;
        END IF;

        -- Cách 2: Tìm chính xác theo vendor_product_name
        IF v_internal_id IS NULL AND v_name IS NOT NULL AND v_name != '' THEN
            SELECT m.internal_product_id, p.name
            INTO v_internal_id, v_internal_name
            FROM vendor_product_mappings m
            JOIN products p ON p.id = m.internal_product_id
            WHERE m.vendor_id = p_vendor_id 
              AND lower(m.vendor_product_name) = lower(v_name)
            LIMIT 1;
            
            IF FOUND THEN
                v_method := 'Exact Name';
                v_score := 1.0;
            END IF;
        END IF;

        -- Cách 3: Fuzzy Match (pg_trgm) với bảng products (nếu chưa tìm thấy)
        -- Sử dụng extension unaccent và pg_trgm
        IF v_internal_id IS NULL AND v_name IS NOT NULL AND v_name != '' THEN
            SELECT p.id, p.name, similarity(unaccent(lower(p.name)), unaccent(lower(v_name))) as sim_score
            INTO v_internal_id, v_internal_name, v_score
            FROM products p
            WHERE p.status = 'active'
            ORDER BY sim_score DESC
            LIMIT 1;
            
            IF v_score >= 0.3 THEN
                v_method := 'Fuzzy Match';
            ELSE
                -- Nếu điểm quá thấp, coi như không tìm thấy
                v_internal_id := NULL;
                v_internal_name := NULL;
                v_method := 'Not Found';
            END IF;
        END IF;

        IF v_internal_id IS NULL THEN
             v_method := 'Not Found';
        END IF;

        RETURN QUERY SELECT 
            v_sku, v_name, v_unit, v_qty, v_price, v_lot, v_expiry,
            v_internal_id, v_internal_name, v_score, v_method;
    END LOOP;
END;
$$;
