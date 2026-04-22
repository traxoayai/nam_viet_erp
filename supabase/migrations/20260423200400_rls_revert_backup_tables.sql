-- Migration: Enable RLS trên 3 bảng backup _revert_double_deduct_*
-- ============================================================================
-- 3 bảng này là admin-only backup, không nên expose cho anon/authenticated.
-- Enable RLS + không tạo policy = deny all cho các role thường.
-- service_role bypass RLS nên migration + rollback SQL vẫn work.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_revert_double_deduct_20260417') THEN
    EXECUTE 'ALTER TABLE public._revert_double_deduct_20260417 ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_revert_double_deduct_20260418') THEN
    EXECUTE 'ALTER TABLE public._revert_double_deduct_20260418 ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_revert_double_deduct_20260423') THEN
    EXECUTE 'ALTER TABLE public._revert_double_deduct_20260423 ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

COMMIT;
