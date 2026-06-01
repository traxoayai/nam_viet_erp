-- Migration: update_ai_mapping_rpc_units
-- Description: Update mapped_invoice_product and map_scanned_invoice_products to include internal_product_unit_id

BEGIN;

-- 1. Drop existing function that depends on the type
DROP FUNCTION IF EXISTS public.map_scanned_invoice_products(bigint, jsonb);

-- 2. Alter the type to add internal_product_unit_id
-- NOTE: No CASCADE — function depending on this type was already dropped above (step 1).
-- Catch duplicate_object (sqlstate 42710) which is the correct error for type attributes,
-- so re-running the migration is idempotent.
DO $$
BEGIN
    ALTER TYPE public.mapped_invoice_product ADD ATTRIBUTE internal_product_unit_id bigint;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Recreate the function with updated logic
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
    
    v_internal_product_unit_id bigint;
    v_vendor_tax_code text;
BEGIN
    -- Lấy tax_code của supplier
    SELECT tax_code INTO v_vendor_tax_code
    FROM suppliers
    WHERE id = p_vendor_id;

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
        v_internal_product_unit_id := NULL;
        v_score := 0;
        v_method := NULL;

        -- Chỉ tìm mapping khi vendor có tax_code
        IF v_vendor_tax_code IS NOT NULL AND v_vendor_tax_code != '' THEN
            -- Cách 1: Tìm chính xác theo supplier_sku
            IF v_sku IS NOT NULL AND v_sku != '' THEN
                SELECT m.internal_product_id, p.name, m.internal_product_unit_id
                INTO v_internal_id, v_internal_name, v_internal_product_unit_id
                FROM vendor_product_mappings m
                JOIN products p ON p.id = m.internal_product_id
                WHERE m.vendor_tax_code = v_vendor_tax_code 
                  AND m.supplier_sku = v_sku 
                LIMIT 1;
                
                IF FOUND THEN
                    v_method := 'Exact SKU';
                    v_score := 1.0;
                END IF;
            END IF;

            -- Cách 2: Tìm chính xác theo vendor_product_name
            IF v_internal_id IS NULL AND v_name IS NOT NULL AND v_name != '' THEN
                SELECT m.internal_product_id, p.name, m.internal_product_unit_id
                INTO v_internal_id, v_internal_name, v_internal_product_unit_id
                FROM vendor_product_mappings m
                JOIN products p ON p.id = m.internal_product_id
                WHERE m.vendor_tax_code = v_vendor_tax_code 
                  AND lower(m.vendor_product_name) = lower(v_name)
                LIMIT 1;
                
                IF FOUND THEN
                    v_method := 'Exact Name';
                    v_score := 1.0;
                END IF;
            END IF;
        END IF;

        -- Cách 3: Fuzzy Match (pg_trgm) với bảng products (nếu chưa tìm thấy)
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
                v_internal_id := NULL;
                v_internal_name := NULL;
                v_method := 'Not Found';
            END IF;
        END IF;

        -- Lấy đơn vị bán buôn (wholesale) nếu chưa có internal_product_unit_id
        IF v_internal_id IS NOT NULL AND v_internal_product_unit_id IS NULL THEN
            SELECT id INTO v_internal_product_unit_id
            FROM product_units
            WHERE product_id = v_internal_id AND unit_type = 'wholesale'
            LIMIT 1;
        END IF;

        IF v_internal_id IS NULL THEN
             v_method := 'Not Found';
        END IF;

        RETURN QUERY SELECT 
            v_sku, v_name, v_unit, v_qty, v_price, v_lot, v_expiry,
            v_internal_id, v_internal_name, v_score, v_method, v_internal_product_unit_id;
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
