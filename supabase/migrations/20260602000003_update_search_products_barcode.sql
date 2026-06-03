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
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''id'', pu.id, 
                            ''unit_name'', pu.unit_name,
                            ''unit_type'', pu.unit_type,
                            ''is_base'', pu.is_base
                        )
                    )
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
