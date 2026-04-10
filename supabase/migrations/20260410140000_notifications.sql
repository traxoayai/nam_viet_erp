-- =============================================================================
-- B2B Portal Notification System
-- Ngày tạo: 2026-04-10
-- Mô tả: Tables, indexes, RLS, RPCs, triggers cho hệ thống thông báo B2B Portal
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ENUM TYPE
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.b2b_notification_type AS ENUM (
    'order_status',       -- Cập nhật trạng thái đơn hàng
    'invoice',            -- Hóa đơn mới
    'promotion',          -- Khuyến mãi
    'debt_reminder',      -- Nhắc công nợ
    'system',             -- Thông báo hệ thống
    'broadcast'           -- Thông báo chung cho tất cả KH
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- 2a. b2b_notifications
CREATE TABLE IF NOT EXISTS public.b2b_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_b2b_id BIGINT REFERENCES public.customers_b2b(id) ON DELETE CASCADE,
  -- NULL = broadcast tới tất cả khách hàng
  type          public.b2b_notification_type NOT NULL DEFAULT 'system',
  title         TEXT NOT NULL,
  body          TEXT,
  data          JSONB DEFAULT '{}'::jsonb,
  -- data chứa context: { order_id, invoice_id, promotion_id, ... }
  is_read       BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.b2b_notifications IS 'Thông báo cho khách hàng B2B trên Portal';
COMMENT ON COLUMN public.b2b_notifications.customer_b2b_id IS 'NULL = broadcast cho tất cả khách hàng';
COMMENT ON COLUMN public.b2b_notifications.data IS 'JSON context: order_id, invoice_id, url, ...';

-- 2b. b2b_push_subscriptions
CREATE TABLE IF NOT EXISTS public.b2b_push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.b2b_push_subscriptions IS 'Web Push subscriptions cho portal users';

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

-- b2b_notifications
CREATE INDEX IF NOT EXISTS idx_b2b_notif_customer
  ON public.b2b_notifications (customer_b2b_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_notif_customer_unread
  ON public.b2b_notifications (customer_b2b_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_b2b_notif_type
  ON public.b2b_notifications (type);

CREATE INDEX IF NOT EXISTS idx_b2b_notif_created
  ON public.b2b_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_notif_broadcast
  ON public.b2b_notifications (created_at DESC)
  WHERE customer_b2b_id IS NULL;

-- b2b_push_subscriptions
CREATE INDEX IF NOT EXISTS idx_b2b_push_sub_user
  ON public.b2b_push_subscriptions (portal_user_id);

-- =============================================================================
-- 4. RLS POLICIES
-- =============================================================================

-- 4a. b2b_notifications policies (DROP IF EXISTS để idempotent)
DROP POLICY IF EXISTS "b2b_notif_select_own" ON public.b2b_notifications;
DROP POLICY IF EXISTS "b2b_notif_update_read" ON public.b2b_notifications;
DROP POLICY IF EXISTS "b2b_notif_insert_service" ON public.b2b_notifications;
DROP POLICY IF EXISTS "b2b_notif_service_all" ON public.b2b_notifications;
DROP POLICY IF EXISTS "b2b_push_select_own" ON public.b2b_push_subscriptions;
DROP POLICY IF EXISTS "b2b_push_insert_own" ON public.b2b_push_subscriptions;
DROP POLICY IF EXISTS "b2b_push_delete_own" ON public.b2b_push_subscriptions;
DROP POLICY IF EXISTS "b2b_push_service_all" ON public.b2b_push_subscriptions;

-- Khách hàng đọc thông báo của mình + broadcast (customer_b2b_id IS NULL)
CREATE POLICY "b2b_notif_select_own"
  ON public.b2b_notifications
  FOR SELECT
  TO authenticated
  USING (
    customer_b2b_id IS NULL  -- broadcast
    OR customer_b2b_id = (
      SELECT pu.customer_b2b_id
      FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Khách hàng đánh dấu đã đọc thông báo của mình
CREATE POLICY "b2b_notif_update_read"
  ON public.b2b_notifications
  FOR UPDATE
  TO authenticated
  USING (
    customer_b2b_id IS NULL
    OR customer_b2b_id = (
      SELECT pu.customer_b2b_id
      FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    -- Chỉ cho phép update is_read và read_at
    is_read = true
  );

-- service_role insert (server-side)
CREATE POLICY "b2b_notif_insert_service"
  ON public.b2b_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- service_role full access (admin RPCs dùng SECURITY DEFINER)
CREATE POLICY "b2b_notif_service_all"
  ON public.b2b_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4b. b2b_push_subscriptions policies
-- Portal user quản lý subscription của mình
CREATE POLICY "b2b_push_select_own"
  ON public.b2b_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    portal_user_id = (
      SELECT pu.id
      FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "b2b_push_insert_own"
  ON public.b2b_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_user_id = (
      SELECT pu.id
      FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "b2b_push_delete_own"
  ON public.b2b_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    portal_user_id = (
      SELECT pu.id
      FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- service_role full access
CREATE POLICY "b2b_push_service_all"
  ON public.b2b_push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 5. ENABLE REALTIME
-- =============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 6. RPCs
-- =============================================================================

-- 6a. get_customer_notifications (phân trang)
CREATE OR REPLACE FUNCTION public.get_customer_notifications(
  p_customer_b2b_id BIGINT,
  p_type            TEXT DEFAULT NULL,
  p_unread_only     BOOLEAN DEFAULT false,
  p_page            INT DEFAULT 1,
  p_page_size       INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_data   JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Count
  SELECT COUNT(*) INTO v_total
  FROM public.b2b_notifications n
  WHERE (n.customer_b2b_id = p_customer_b2b_id OR n.customer_b2b_id IS NULL)
    AND (p_type IS NULL OR n.type::text = p_type)
    AND (NOT p_unread_only OR n.is_read = false);

  -- Data
  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      n.id,
      n.customer_b2b_id,
      n.type,
      n.title,
      n.body,
      n.data,
      n.is_read,
      n.read_at,
      n.created_at
    FROM public.b2b_notifications n
    WHERE (n.customer_b2b_id = p_customer_b2b_id OR n.customer_b2b_id IS NULL)
      AND (p_type IS NULL OR n.type::text = p_type)
      AND (NOT p_unread_only OR n.is_read = false)
    ORDER BY n.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- 6b. get_customer_unread_notification_count
CREATE OR REPLACE FUNCTION public.get_customer_unread_notification_count(
  p_customer_b2b_id BIGINT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM public.b2b_notifications n
  WHERE (n.customer_b2b_id = p_customer_b2b_id OR n.customer_b2b_id IS NULL)
    AND n.is_read = false;

  RETURN v_count;
END;
$$;

-- 6c. mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID,
  p_customer_b2b_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.b2b_notifications
  SET is_read = true,
      read_at = now()
  WHERE id = p_notification_id
    AND (customer_b2b_id = p_customer_b2b_id OR customer_b2b_id IS NULL)
    AND is_read = false;

  RETURN FOUND;
END;
$$;

-- 6d. mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_customer_b2b_id BIGINT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.b2b_notifications
  SET is_read = true,
      read_at = now()
  WHERE (customer_b2b_id = p_customer_b2b_id OR customer_b2b_id IS NULL)
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6e. get_notification_history (admin — phân trang, filter theo customer/type/date)
CREATE OR REPLACE FUNCTION public.get_notification_history(
  p_customer_b2b_id BIGINT DEFAULT NULL,
  p_type            TEXT DEFAULT NULL,
  p_date_from       TIMESTAMPTZ DEFAULT NULL,
  p_date_to         TIMESTAMPTZ DEFAULT NULL,
  p_page            INT DEFAULT 1,
  p_page_size       INT DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_data   JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM public.b2b_notifications n
  WHERE (p_customer_b2b_id IS NULL OR n.customer_b2b_id = p_customer_b2b_id)
    AND (p_type IS NULL OR n.type::text = p_type)
    AND (p_date_from IS NULL OR n.created_at >= p_date_from)
    AND (p_date_to IS NULL OR n.created_at <= p_date_to);

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      n.id,
      n.customer_b2b_id,
      c.name AS customer_name,
      c.customer_code,
      n.type,
      n.title,
      n.body,
      n.data,
      n.is_read,
      n.read_at,
      n.created_at
    FROM public.b2b_notifications n
    LEFT JOIN public.customers_b2b c ON c.id = n.customer_b2b_id
    WHERE (p_customer_b2b_id IS NULL OR n.customer_b2b_id = p_customer_b2b_id)
      AND (p_type IS NULL OR n.type::text = p_type)
      AND (p_date_from IS NULL OR n.created_at >= p_date_from)
      AND (p_date_to IS NULL OR n.created_at <= p_date_to)
    ORDER BY n.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- =============================================================================
-- 7. TRIGGER FUNCTIONS
-- =============================================================================

-- 7a. Trigger function: notify khi đơn hàng thay đổi trạng thái
CREATE OR REPLACE FUNCTION public.fn_notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_label TEXT;
  v_title        TEXT;
  v_body         TEXT;
BEGIN
  -- Chỉ fire khi status thực sự thay đổi
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Chỉ xử lý đơn B2B (có customer_id)
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map status sang label tiếng Việt
  v_status_label := CASE NEW.status
    WHEN 'DRAFT'     THEN 'Nháp'
    WHEN 'PENDING'   THEN 'Chờ xác nhận'
    WHEN 'CONFIRMED' THEN 'Đã xác nhận'
    WHEN 'PACKED'    THEN 'Đã đóng gói'
    WHEN 'SHIPPING'  THEN 'Đang giao hàng'
    WHEN 'DELIVERED' THEN 'Đã giao hàng'
    WHEN 'COMPLETED' THEN 'Hoàn thành'
    WHEN 'CANCELLED' THEN 'Đã hủy'
    ELSE NEW.status
  END;

  v_title := 'Đơn hàng ' || COALESCE(NEW.code, NEW.id::text) || ' — ' || v_status_label;
  v_body  := 'Đơn hàng ' || COALESCE(NEW.code, NEW.id::text)
             || ' đã chuyển sang trạng thái: ' || v_status_label || '.';

  INSERT INTO public.b2b_notifications (
    customer_b2b_id, type, title, body, data
  ) VALUES (
    NEW.customer_id,
    'order_status',
    v_title,
    v_body,
    jsonb_build_object(
      'order_id', NEW.id,
      'order_code', NEW.code,
      'old_status', OLD.status,
      'new_status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

-- 7b. Trigger function: notify khi tạo hóa đơn mới
CREATE OR REPLACE FUNCTION public.fn_notify_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
BEGIN
  -- Chỉ xử lý hóa đơn B2B (có customer_id)
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := 'Hóa đơn mới: ' || COALESCE(NEW.invoice_number, 'HĐ-' || NEW.id::text);
  v_body  := 'Hóa đơn ' || COALESCE(NEW.invoice_number, 'HĐ-' || NEW.id::text)
             || ' đã được tạo với tổng tiền '
             || COALESCE(to_char(NEW.final_amount, 'FM999,999,999,999'), '0') || ' đ.';

  INSERT INTO public.b2b_notifications (
    customer_b2b_id, type, title, body, data
  ) VALUES (
    NEW.customer_id,
    'invoice',
    v_title,
    v_body,
    jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'final_amount', NEW.final_amount,
      'order_id', NEW.order_id
    )
  );

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 8. TRIGGERS
-- =============================================================================

-- 8a. Trigger: order status change
DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_order_status_change();

-- 8b. Trigger: invoice created
DROP TRIGGER IF EXISTS trg_notify_invoice_created ON public.sales_invoices;
CREATE TRIGGER trg_notify_invoice_created
  AFTER INSERT ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_invoice_created();

COMMIT;
