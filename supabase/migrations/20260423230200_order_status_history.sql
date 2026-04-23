-- Audit log cho orders.status transitions
-- ============================================================================
-- WHY: Không có log khi status đổi → khó diagnose "đơn X chuyển CONFIRMED lúc
--      nào bởi ai vì lý do gì" (payment received? manual cancel? trigger?).
-- DESIGN: Table order_status_history + trigger AFTER UPDATE OF status.
--         Ghi old/new status, actor, reason (auto-infer từ transition).
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx
  ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS order_status_history_created_at_idx
  ON public.order_status_history(created_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_status_history_read_authenticated" ON public.order_status_history;
CREATE POLICY "order_status_history_read_authenticated"
  ON public.order_status_history FOR SELECT
  TO authenticated USING (true);

-- INSERT chỉ qua trigger SECURITY DEFINER — không cho user INSERT trực tiếp
-- (dùng REVOKE, không cần policy INSERT).
REVOKE INSERT ON public.order_status_history FROM authenticated;
REVOKE UPDATE ON public.order_status_history FROM authenticated;
REVOKE DELETE ON public.order_status_history FROM authenticated;

COMMENT ON TABLE public.order_status_history IS
  'Audit log cho orders.status transitions. Trigger trg_order_status_history insert mỗi row update status. read-only cho authenticated.';

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE
        WHEN OLD.status = 'PENDING' AND NEW.status = 'CONFIRMED' THEN 'payment_received'
        WHEN NEW.status = 'CANCELLED' THEN 'cancelled'
        WHEN NEW.status = 'PACKED' THEN 'packed'
        WHEN NEW.status = 'SHIPPING' THEN 'shipping'
        WHEN NEW.status = 'DELIVERED' THEN 'delivered'
        WHEN NEW.status = 'COMPLETED' THEN 'completed'
        ELSE 'manual_update'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_history ON public.orders;
CREATE TRIGGER trg_order_status_history
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

COMMIT;
