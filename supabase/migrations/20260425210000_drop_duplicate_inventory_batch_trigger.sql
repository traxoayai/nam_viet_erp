-- Drop trigger + function trùng lặp trên inventory_batches
-- Có 2 trigger cùng event AFTER INSERT OR DELETE OR UPDATE:
--   on_inventory_batch_change → sync_inventory_batch_to_total()   (cũ hơn, không có updated_at)
--   trg_sync_batch_to_total   → fn_sync_inventory_batch_to_total() (mới hơn, có updated_at + comments)
-- Giữ lại: trg_sync_batch_to_total + fn_sync_inventory_batch_to_total
-- Drop:    on_inventory_batch_change + sync_inventory_batch_to_total
-- 2026-04-25

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_inventory_batch_change') THEN
    DROP TRIGGER IF EXISTS on_inventory_batch_change ON public.inventory_batches;
    DROP FUNCTION IF EXISTS public.sync_inventory_batch_to_total() CASCADE;
    RAISE NOTICE 'Dropped on_inventory_batch_change + sync_inventory_batch_to_total';
  ELSE
    RAISE NOTICE 'Trigger on_inventory_batch_change not found, skipping';
  END IF;
END$$;

-- Giữ lại trg_sync_batch_to_total + fn_sync_inventory_batch_to_total (version mới hơn)
NOTIFY pgrst, 'reload schema';

COMMIT;
