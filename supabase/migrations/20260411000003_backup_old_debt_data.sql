-- ============================================================
-- Backup Old Debt Data for Audit
-- 1. Tạo cột backup current_debt_bak
-- 2. Khôi phục giá trị cũ từ system_logs (đã lưu tự động khi cháu chạy sync)
-- Ngày: 2026-04-09
-- ============================================================

BEGIN;

-- A. Tạo cột backup nếu chưa có
ALTER TABLE public.customers_b2b ADD COLUMN IF NOT EXISTS current_debt_bak NUMERIC;

-- B. Khôi phục giá trị cũ từ logs
-- Lấy log mới nhất của module 'customers_b2b' vừa được tạo ra cách đây vài phút
UPDATE public.customers_b2b c
SET current_debt_bak = (
    SELECT (old_data->>'current_debt')::NUMERIC
    FROM public.system_logs l
    WHERE l.module = 'customers_b2b'
      AND l.record_id = c.id::TEXT
      AND l.created_at > NOW() - INTERVAL '30 minutes'
      AND l.created_at < NOW() -- đảm bảo lấy cái vừa mới tạo
    ORDER BY l.created_at DESC
    LIMIT 1
);

COMMIT;
