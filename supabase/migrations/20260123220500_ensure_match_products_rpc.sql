-- Enable pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION match_products_from_excel(p_data jsonb)
RETURNS TABLE (
    excel_sku text,
    excel_name text,
    product_id bigint,
    product_name text,
    product_sku text,
    product_status text,
    base_unit text,
    similarity_score double precision
) 
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    v_sku text;
    v_name text;
    rec record;
    best_match record;
    current_score double precision;
BEGIN
    -- Iterate over each item in the input JSON array
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_sku := trim(both from (item->>'excel_sku'));
        v_name := item->>'excel_name';
        
        -- Reset variables
        best_match := null;
        current_score := 0;

        -- 1. Exact SKU Match (Active only)
        IF v_sku IS NOT NULL AND v_sku <> '' THEN
            SELECT id, name, sku, status, retail_unit, 1.0 as score
            INTO rec
            FROM products
            WHERE sku = v_sku AND status = 'active'
            LIMIT 1;
            
            IF FOUND THEN
                best_match := rec;
                current_score := 1.0;
            END IF;
        END IF;

        -- 2. Exact Name Match (If no SKU match found)
        IF best_match IS NULL AND v_name IS NOT NULL AND v_name <> '' THEN
            SELECT id, name, sku, status, retail_unit, 1.0 as score
            INTO rec
            FROM products
            WHERE lower(name) = lower(v_name) AND status = 'active'
            LIMIT 1;

            IF FOUND THEN
                best_match := rec;
                current_score := 1.0;
            END IF;
        END IF;

        -- 3. Fuzzy Name Match (If still no match)
        IF best_match IS NULL AND v_name IS NOT NULL AND v_name <> '' THEN
            -- Use similarity from pg_trgm, threshold 0.4
            SELECT id, name, sku, status, retail_unit, similarity(name, v_name) as score
            INTO rec
            FROM products
            WHERE status = 'active' 
              AND similarity(name, v_name) > 0.4
            ORDER BY similarity(name, v_name) DESC
            LIMIT 1;

            IF FOUND THEN
                best_match := rec;
                current_score := rec.score;
            END IF;
        END IF;

        -- Return result row
        excel_sku := v_sku;
        excel_name := v_name;
        
        IF best_match IS NOT NULL THEN
            product_id := best_match.id;
            product_name := best_match.name;
            product_sku := best_match.sku;
            product_status := best_match.status;
            base_unit := best_match.retail_unit;
            similarity_score := current_score;
        ELSE
            product_id := null;
            product_name := null;
            product_sku := null;
            product_status := null;
            base_unit := null;
            similarity_score := 0;
        END IF;

        RETURN NEXT;
    END LOOP;
END;
$$;
