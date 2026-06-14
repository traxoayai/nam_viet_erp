-- =============================================================================
-- Provinces Table — Viettel Post Province Master Data
-- Ngày: 2026-06-14
-- Mục đích: Store Viettel Post province codes + delivery time standards
-- Sync: auto-sync từ Viettel API via sync_viettel_provinces() RPC
-- =============================================================================
BEGIN;

-- 1. Create provinces table
CREATE TABLE IF NOT EXISTS public.provinces (
  province_code TEXT PRIMARY KEY,
  province_name TEXT NOT NULL,
  delivery_time_std INTEGER, -- Standard delivery time in days
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_provinces_name
  ON public.provinces (province_name);
CREATE INDEX IF NOT EXISTS idx_provinces_synced_at
  ON public.provinces (last_synced_at DESC NULLS LAST);

-- 3. Enable RLS
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — lookup table, allow all SELECT
DO $$ BEGIN
  CREATE POLICY "anon_select_provinces"
    ON public.provinces FOR SELECT
    TO authenticated, anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_provinces"
    ON public.provinces FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_provinces_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_provinces_timestamp ON public.provinces;
CREATE TRIGGER trigger_update_provinces_timestamp
  BEFORE UPDATE ON public.provinces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_provinces_timestamp();

COMMIT;
