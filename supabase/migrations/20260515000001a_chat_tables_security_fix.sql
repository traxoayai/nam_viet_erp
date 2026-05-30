-- Fix security issues từ code review Task 1:
-- 1. Revoke EXECUTE từ anon (chỉ authenticated + service_role)
-- 2. Enable RLS default-deny trên 3 bảng (policies cụ thể sẽ thêm ở Task 2)

BEGIN;

-- Issue 1: Restrict get_columns GRANT
REVOKE EXECUTE ON FUNCTION public.get_columns(text) FROM anon;
-- authenticated + service_role giữ nguyên (test dùng service_role, future Portal authenticated dùng để introspect schema chính họ)

-- Issue 2: Enable RLS default-deny
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_handoffs ENABLE ROW LEVEL SECURITY;

COMMIT;
