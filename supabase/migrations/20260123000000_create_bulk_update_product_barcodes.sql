-- Migration to create bulk_update_product_barcodes RPC
-- Created for QuickBarcodePage functionality

CREATE OR REPLACE FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_base_barcode TEXT;
    v_wholesale_barcode TEXT;
    
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        v_base_barcode := trim(item->>'base_barcode');
        v_wholesale_barcode := trim(item->>'wholesale_barcode');

        -- 1. Get Unit Names for context
        SELECT wholesale_unit, retail_unit 
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- 2. Update Retail/Base Barcode
        -- Update for units marked as base OR matching retail unit name OR type 'retail'
        IF v_base_barcode IS NOT NULL THEN
            UPDATE public.product_units
            SET barcode = v_base_barcode,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (is_base = true OR unit_name = v_retail_unit_name OR unit_type = 'retail');
        END IF;

        -- 3. Update Wholesale Barcode
        -- Update for units marked as type 'wholesale' OR matching wholesale unit name
        IF v_wholesale_barcode IS NOT NULL THEN
             UPDATE public.product_units
            SET barcode = v_wholesale_barcode,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (unit_name = v_wholesale_unit_name OR unit_type = 'wholesale')
              AND is_base = false; -- Ensure we don't accidentally overwrite base if logic overlaps (unlikely but safe)
        END IF;

    END LOOP;
END;
$$;
