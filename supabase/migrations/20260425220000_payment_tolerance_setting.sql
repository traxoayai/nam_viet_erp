-- Tạo constant payment_tolerance trong system_settings
-- + helper function get_payment_tolerance() để future migrations dùng thay magic 100đ
-- KHÔNG sửa các function hiện đang hard-code 100 (defer, thực hiện dần)
-- 2026-04-25

BEGIN;

-- Thêm cột description nếu chưa có (system_settings schema gốc không có)
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS description text;

-- Upsert giá trị mặc định tolerance kế toán
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'payment_tolerance',
  '100'::jsonb,
  'Tolerance kế toán cho payment allocation (đồng). Magic number 100đ — dùng get_payment_tolerance() thay hard-code.'
)
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;
  -- KHÔNG overwrite value nếu đã được admin chỉnh thủ công

-- Helper function: trả về tolerance numeric, fallback = 100 nếu chưa set
CREATE OR REPLACE FUNCTION public.get_payment_tolerance()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value#>>'{}')::numeric
     FROM public.system_settings
     WHERE key = 'payment_tolerance'),
    100
  );
$$;

COMMENT ON FUNCTION public.get_payment_tolerance() IS
  'Trả về tolerance kế toán (đồng) từ system_settings.payment_tolerance. Fallback = 100 nếu chưa set.';

GRANT EXECUTE ON FUNCTION public.get_payment_tolerance() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
