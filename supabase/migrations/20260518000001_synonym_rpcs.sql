-- Gap 1 Chatbot P2.5: RPC SECURITY DEFINER cho Marketing quản lý
-- product_synonyms qua trang /marketing/chatbot/synonyms.
-- Gate quyền dùng public.is_chat_staff() (crm.chatbot.handle | crm.chatbot.admin).
-- Tất cả RPC: REVOKE PUBLIC/anon, chỉ authenticated được EXECUTE.

BEGIN;

-- ─── 1. list_product_synonyms ───────────────────────────────────────────
-- Trả tất cả synonym của 1 SP. Caller phải là chat staff.
CREATE OR REPLACE FUNCTION public.list_product_synonyms(p_product_id bigint)
RETURNS TABLE (id bigint, synonym text, weight real, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT ps.id, ps.synonym, ps.weight, ps.created_at
  FROM public.product_synonyms ps
  WHERE ps.product_id = p_product_id
    AND public.is_chat_staff()
  ORDER BY ps.weight DESC, ps.synonym;
$$;

COMMENT ON FUNCTION public.list_product_synonyms(bigint) IS
  'Gap 1 P2.5: list synonyms của 1 SP cho Marketing. Yêu cầu is_chat_staff().';

-- ─── 2. add_product_synonym ─────────────────────────────────────────────
-- Insert (upsert weight on conflict). Validate length >= 2.
-- Weight clamp [0.1, 10.0]. Trim + lowercase synonym để tránh trùng case.
CREATE OR REPLACE FUNCTION public.add_product_synonym(
  p_product_id bigint,
  p_synonym text,
  p_weight real DEFAULT 1.0
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id bigint;
  v_clean text;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_clean := trim(lower(coalesce(p_synonym, '')));
  IF length(v_clean) < 2 THEN
    RAISE EXCEPTION 'Synonym phải >= 2 ký tự' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.product_synonyms (product_id, synonym, weight)
  VALUES (
    p_product_id,
    v_clean,
    GREATEST(0.1::real, LEAST(coalesce(p_weight, 1.0)::real, 10.0::real))
  )
  ON CONFLICT (product_id, synonym) DO UPDATE
    SET weight = EXCLUDED.weight
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.add_product_synonym(bigint, text, real) IS
  'Gap 1 P2.5: thêm/cập nhật synonym của SP. Yêu cầu is_chat_staff().';

-- ─── 3. delete_product_synonym ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_product_synonym(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.product_synonyms WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.delete_product_synonym(bigint) IS
  'Gap 1 P2.5: xóa 1 synonym. Yêu cầu is_chat_staff().';

-- ─── 4. search_products_for_synonym_admin ───────────────────────────────
-- ILIKE search products theo name hoặc sku, kèm count synonym đã có.
-- Limit 20 mặc định. Chỉ trả SP active.
CREATE OR REPLACE FUNCTION public.search_products_for_synonym_admin(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  name text,
  sku text,
  active_ingredient text,
  synonym_count int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    p.id,
    p.name,
    p.sku,
    p.active_ingredient,
    (SELECT COUNT(*)::int
       FROM public.product_synonyms ps
      WHERE ps.product_id = p.id) AS synonym_count
  FROM public.products p
  WHERE public.is_chat_staff()
    AND p.status = 'active'
    AND length(coalesce(p_query, '')) >= 1
    AND (
      p.name ILIKE '%' || p_query || '%'
      OR p.sku ILIKE '%' || p_query || '%'
    )
  ORDER BY p.name
  LIMIT GREATEST(coalesce(p_limit, 20), 1);
$$;

COMMENT ON FUNCTION public.search_products_for_synonym_admin(text, int) IS
  'Gap 1 P2.5: picker SP cho trang quản lý synonym. is_chat_staff() gate.';

-- ─── 5. bulk_import_synonyms ────────────────────────────────────────────
-- Input: jsonb array [{sku, synonym, weight?}]. Trả {inserted, skipped, errors}.
-- Lookup product_id qua sku (active). SKU không tồn tại → skip + push errors.
-- Mọi exception khi insert → skip + push errors (không abort batch).
CREATE OR REPLACE FUNCTION public.bulk_import_synonyms(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row jsonb;
  v_product_id bigint;
  v_sku text;
  v_syn text;
  v_weight real;
  v_inserted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows phải là jsonb array' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_sku := nullif(trim(v_row->>'sku'), '');
    v_syn := nullif(trim(lower(v_row->>'synonym')), '');
    v_weight := GREATEST(
      0.1::real,
      LEAST(coalesce((v_row->>'weight')::real, 1.0::real), 10.0::real)
    );

    IF v_sku IS NULL OR v_syn IS NULL OR length(v_syn) < 2 THEN
      v_errors := v_errors || jsonb_build_object(
        'sku', v_sku,
        'synonym', v_syn,
        'reason', 'sku/synonym rỗng hoặc synonym < 2 ký tự'
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT p.id INTO v_product_id
    FROM public.products p
    WHERE p.sku = v_sku AND p.status = 'active'
    LIMIT 1;

    IF v_product_id IS NULL THEN
      v_errors := v_errors || jsonb_build_object(
        'sku', v_sku,
        'synonym', v_syn,
        'reason', 'SKU không tồn tại'
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.product_synonyms (product_id, synonym, weight)
      VALUES (v_product_id, v_syn, v_weight)
      ON CONFLICT (product_id, synonym) DO UPDATE
        SET weight = EXCLUDED.weight;
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'sku', v_sku,
        'synonym', v_syn,
        'reason', SQLERRM
      );
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

COMMENT ON FUNCTION public.bulk_import_synonyms(jsonb) IS
  'Gap 1 P2.5: bulk import synonyms từ CSV Marketing. is_chat_staff() gate.';

-- ─── Grants ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.list_product_synonyms(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_product_synonyms(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_product_synonym(bigint, text, real) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_product_synonym(bigint, text, real) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_product_synonym(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_product_synonym(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_products_for_synonym_admin(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_products_for_synonym_admin(text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bulk_import_synonyms(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bulk_import_synonyms(jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.list_product_synonyms(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_product_synonym(bigint, text, real) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_product_synonym(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_products_for_synonym_admin(text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_import_synonyms(jsonb) TO authenticated, service_role;

COMMIT;
