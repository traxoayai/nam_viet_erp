-- Migration: Tạo helper RPC get_b2b_warehouse_id
-- Mục đích: Single source of truth cho "kho B2B đang dùng"
-- Hôm nay: trả về 1 kho duy nhất có type='b2b' AND status='active'
-- Tương lai: chỉ cần sửa function này khi có nhiều kho B2B
-- Date: 2026-04-17

BEGIN;

CREATE OR REPLACE FUNCTION public.get_b2b_warehouse_id()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id
  FROM public.warehouses
  WHERE type = 'b2b' AND status = 'active'
  ORDER BY id ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy kho B2B nào đang hoạt động (warehouses.type=''b2b'' AND status=''active'').';
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_b2b_warehouse_id() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
