-- Journal Entry tables per TT133 accounting standard
-- Tương thích với migration 20260607000001 (hệ hạch toán kép).
-- Thêm RLS policies + fixtures vào bảng hiện có.
-- Note: bảng journal_entries + journal_entry_lines đã tạo ở 20260607000001,
-- không tạo lại để tránh conflict.
-- Created: 2026-06-14
BEGIN;

-- Verify RLS enabled on journal_entries (added in 20260607000001, recheck idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = 'journal_entries'
      AND t.table_name IN (
        SELECT table_name FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'journal_entries'
          AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      )
  ) THEN
    -- RLS chưa bật hoặc policies chưa tạo
    ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = 'journal_entry_lines'
      AND t.table_name IN (
        SELECT table_name FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'journal_entry_lines'
          AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      )
  ) THEN
    ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Journal entries RLS policies (idempotent: drop + recreate)
DROP POLICY IF EXISTS "select_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "insert_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "update_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "delete_journal_entries" ON public.journal_entries;

CREATE POLICY "select_journal_entries" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "insert_journal_entries" ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_journal_entries" ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (status != 'posted' AND auth.uid() IS NOT NULL);

CREATE POLICY "delete_journal_entries" ON public.journal_entries
  FOR DELETE TO authenticated
  USING (status != 'posted' AND auth.uid() IS NOT NULL);

-- Journal entry lines RLS policies (idempotent: drop + recreate)
DROP POLICY IF EXISTS "select_journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "insert_journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "update_journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "delete_journal_entry_lines" ON public.journal_entry_lines;

CREATE POLICY "select_journal_entry_lines" ON public.journal_entry_lines
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "insert_journal_entry_lines" ON public.journal_entry_lines
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_journal_entry_lines" ON public.journal_entry_lines
  FOR UPDATE TO authenticated
  USING (
    (SELECT status FROM public.journal_entries WHERE id = entry_id) != 'posted'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "delete_journal_entry_lines" ON public.journal_entry_lines
  FOR DELETE TO authenticated
  USING (
    (SELECT status FROM public.journal_entries WHERE id = entry_id) != 'posted'
    AND auth.uid() IS NOT NULL
  );

COMMIT;
