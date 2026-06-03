-- 1. Hàm Search tự động tách từ khóa bằng unaccent
CREATE OR REPLACE FUNCTION public.search_products_for_barcode_assign(p_keyword text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
    v_clean_keyword text;
    v_words text[];
    v_word text;
    v_sql text;
    v_result jsonb;
BEGIN
    v_clean_keyword := btrim(p_keyword);
    IF v_clean_keyword = '' THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Split by space into array, removing empty elements
    v_words := regexp_split_to_array(v_clean_keyword, '\s+');
    
    v_sql := '
        WITH matched_products AS (
            SELECT 
                p.id, 
                p.name, 
                p.sku, 
                p.image_url
            FROM public.products p
            WHERE p.status = ''active'' ';

    FOREACH v_word IN ARRAY v_words
    LOOP
        IF length(v_word) > 0 THEN
            -- Tìm kiếm trên name HOẶC sku
            v_sql := v_sql || format(' AND (unaccent(p.name) ILIKE unaccent(%L) OR unaccent(p.sku) ILIKE unaccent(%L)) ', '%' || v_word || '%', '%' || v_word || '%');
        END IF;
    END LOOP;

    v_sql := v_sql || '
            ORDER BY p.id DESC 
            LIMIT 10
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                ''id'', mp.id,
                ''name'', mp.name,
                ''sku'', mp.sku,
                ''image_url'', mp.image_url,
                ''product_units'', (
                    SELECT jsonb_agg(jsonb_build_object(''id'', pu.id, ''unit_name'', pu.unit_name))
                    FROM public.product_units pu 
                    WHERE pu.product_id = mp.id
                )
            )
        )
        FROM matched_products mp;
    ';

    EXECUTE v_sql INTO v_result;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;

-- 2. Cập nhật hàm bulk update hỗ trợ XÓA mã vạch
CREATE OR REPLACE FUNCTION public.bulk_update_product_barcodes(p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_base_barcode TEXT;
    v_wholesale_barcode TEXT;
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
    v_primary_barcode TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        
        -- Get Unit Names for context
        SELECT wholesale_unit, retail_unit
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- Update Retail/Base Barcode
        IF item ? 'base_barcode' THEN
            v_base_barcode := btrim(item->>'base_barcode');
            UPDATE public.product_units
            SET barcode = NULLIF(v_base_barcode, ''),
                updated_at = NOW()
            WHERE product_id = v_product_id
              AND (is_base = true OR unit_name = v_retail_unit_name OR unit_type = 'retail');
        END IF;

        -- Update Wholesale Barcode
        IF item ? 'wholesale_barcode' THEN
            v_wholesale_barcode := btrim(item->>'wholesale_barcode');
            UPDATE public.product_units
            SET barcode = NULLIF(v_wholesale_barcode, ''),
                updated_at = NOW()
            WHERE product_id = v_product_id
              AND (unit_name = v_wholesale_unit_name OR unit_type = 'wholesale')
              AND is_base = false;
        END IF;

        -- Sync to products.barcode (Priority: Retail -> Wholesale)
        IF (item ? 'base_barcode') OR (item ? 'wholesale_barcode') THEN
            v_primary_barcode := COALESCE(
               NULLIF(btrim(item->>'base_barcode'), ''),
               NULLIF(btrim(item->>'wholesale_barcode'), '')
            );
            
            UPDATE public.products
            SET barcode = v_primary_barcode,
                updated_at = NOW()
            WHERE id = v_product_id;
        END IF;

    END LOOP;
END;
$fn$;
