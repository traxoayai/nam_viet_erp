-- =============================================================================
-- Notification Click Navigation
-- Ngày tạo: 2026-04-15
-- Mô tả:
--   1. Thêm cột category + metadata vào notifications
--   2. Cập nhật notify_users_by_permission() hỗ trợ category + metadata
--   3. Cập nhật trigger_notify_finance_approval() → category + metadata
--   4. Cập nhật trigger_notify_warehouse_po() → category + metadata
--   5. Cập nhật fn_notify_admin_payment_received() → category + metadata
--   6. Cập nhật fn_notify_admin_new_registration() → category
--   7. Cập nhật fn_notify_admin_new_portal_order() → category
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. SCHEMA CHANGES
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.category
  IS 'Loại thông báo để điều hướng: expense_approval, purchase_order, payment_received, portal_order, portal_registration, task_update';
COMMENT ON COLUMN public.notifications.metadata
  IS 'Dữ liệu bổ sung cho navigation: entity id, code, ...';

-- Index cho category
CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON public.notifications (category)
  WHERE category IS NOT NULL;

-- =============================================================================
-- 2. BACKFILL category cho dữ liệu cũ (best-effort từ title pattern)
-- =============================================================================

UPDATE public.notifications SET category = 'expense_approval'
WHERE category IS NULL AND title LIKE 'Yêu cầu duyệt%';

UPDATE public.notifications SET category = 'purchase_order'
WHERE category IS NULL AND title = 'Đơn mua hàng mới';

UPDATE public.notifications SET category = 'payment_received'
WHERE category IS NULL AND title LIKE 'Thanh toán mới%';

UPDATE public.notifications SET category = 'portal_registration'
WHERE category IS NULL AND title = 'Đăng ký Portal mới';

UPDATE public.notifications SET category = 'portal_order'
WHERE category IS NULL AND title = 'Đơn hàng Portal mới';

UPDATE public.notifications SET category = 'task_update'
WHERE category IS NULL AND type = 'task_update';

UPDATE public.notifications SET category = 'sales_payment'
WHERE category IS NULL AND title LIKE 'Tiền về%';

-- =============================================================================
-- 3. notify_users_by_permission() — thêm p_category + p_metadata
-- =============================================================================

DROP FUNCTION IF EXISTS public.notify_users_by_permission(text, text, text, text);

CREATE OR REPLACE FUNCTION public.notify_users_by_permission(
  p_permission_key TEXT,
  p_title          TEXT,
  p_message        TEXT,
  p_type           TEXT DEFAULT 'info',
  p_category       TEXT DEFAULT NULL,
  p_metadata       JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, category, metadata, created_at, is_read)
  SELECT DISTINCT ur.user_id, p_title, p_message, p_type, p_category, p_metadata, NOW(), false
  FROM public.role_permissions rp
  JOIN public.user_roles ur ON rp.role_id = ur.role_id
  WHERE rp.permission_key = p_permission_key;
END;
$$;

-- =============================================================================
-- 4. trigger_notify_finance_approval() — thêm category + metadata
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_notify_finance_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Chỉ báo khi tạo mới và trạng thái là pending
  IF NEW.status = 'pending' THEN
    PERFORM notify_users_by_permission(
      'fin-approve-cash',
      'Yêu cầu duyệt ' || CASE WHEN NEW.flow = 'in' THEN 'Thu' ELSE 'Chi' END,
      'Mã phiếu: ' || NEW.code || ' - Số tiền: ' || to_char(NEW.amount, 'FM999,999,999') || ' đ',
      'warning',
      'expense_approval',
      jsonb_build_object('transaction_id', NEW.id, 'code', NEW.code)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5. trigger_notify_warehouse_po() — thêm category + metadata
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_notify_warehouse_po()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Nếu đơn hàng chuyển sang 'pending' (Đã gửi NCC, chờ nhập)
  -- Hoặc tạo mới ở trạng thái pending
  IF NEW.delivery_status = 'pending' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != 'pending') THEN
    PERFORM notify_users_by_permission(
      'inv-stock-view',
      'Đơn mua hàng mới',
      'Đơn PO ' || NEW.code || ' đang chờ nhập kho. Vui lòng kiểm tra.',
      'info',
      'purchase_order',
      jsonb_build_object('po_id', NEW.id, 'po_code', NEW.code)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 6. fn_notify_admin_payment_received() — thêm category + metadata
--    Base: migration 20260414 (version mới nhất, có email support)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_amount_text TEXT;
  v_partner TEXT;
  v_ref TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.flow != 'in' THEN RETURN NEW; END IF;
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  v_amount_text := to_char(NEW.amount, 'FM999,999,999,999') || ' đ';
  v_partner := COALESCE(NEW.partner_name_cache, 'Không rõ');
  v_ref := COALESCE(NEW.ref_id, NEW.code);

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'finance.view_balance', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, metadata, reference_id)
    VALUES (
      v_user.user_id,
      'Thanh toán mới: ' || v_amount_text,
      v_partner || ' — ' || v_ref,
      'success',
      'payment_received',
      jsonb_build_object('transaction_id', NEW.id, 'code', NEW.code, 'ref_id', v_ref),
      NULL
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_payment_received',
            'email', v_user.email,
            'data', jsonb_build_object(
              'amount', v_amount_text,
              'partner_name', v_partner,
              'reference', v_ref,
              'description', COALESCE(NEW.description, '')
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 7. fn_notify_admin_new_registration() — thêm category
--    Base: migration 20260414 (version mới nhất, có email support)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get config for email sending (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, category, reference_id)
    VALUES (
      v_user.user_id,
      'Đăng ký Portal mới',
      NEW.business_name || ' — ' || COALESCE(NEW.contact_name, NEW.email),
      'info',
      'portal_registration',
      NEW.id
    );

    -- Email (best-effort, async via pg_net)
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_new_registration',
            'email', v_user.email,
            'data', jsonb_build_object(
              'business_name', NEW.business_name,
              'contact_name', COALESCE(NEW.contact_name, ''),
              'contact_email', COALESCE(NEW.email, ''),
              'contact_phone', COALESCE(NEW.phone, '')
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 8. fn_notify_admin_new_portal_order() — thêm category
--    Base: migration 20260414 (version mới nhất, có email support)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_portal_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_customer_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF COALESCE(NEW.source, 'erp') <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(cb.name, 'Khách hàng')
  INTO v_customer_name
  FROM public.customers_b2b cb
  WHERE cb.id = NEW.customer_id
  LIMIT 1;
  v_customer_name := COALESCE(v_customer_name, 'Khách hàng');

  -- Get config for email (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, category, reference_id)
    VALUES (
      v_user.user_id,
      'Đơn hàng Portal mới',
      NEW.code || ' — ' || v_customer_name,
      'info',
      'portal_order',
      NEW.id
    );

    -- Email (best-effort, async)
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_new_order',
            'email', v_user.email,
            'data', jsonb_build_object(
              'order_code', NEW.code,
              'customer_name', v_customer_name,
              'total_amount', COALESCE(NEW.final_amount, NEW.total_amount, 0)
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;
