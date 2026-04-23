-- HOTFIX P0: Fix 4 blocker trong notify_payment_received + bank parser
-- ============================================================================
-- BLOCKERS (phát hiện qua code-review):
--
-- B1: notify_payment_received section 4 query `user_roles.role` — cột không
--     tồn tại (schema có role_id → public.roles.name). Mọi UPDATE orders
--     đưa PENDING → CONFIRMED sẽ fire trigger → THROW 42703 → ROLLBACK
--     toàn bộ → tiền biến mất. (Damage hiện tại: 0 đơn vì chưa có webhook
--     Timo fire sau deploy — nhưng active risk.)
--
-- B2: Tên vault secret sai (`project_url`, `service_role_key`). Prod dùng
--     `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` → v_supabase_url luôn NULL
--     → email KH + NV KD KHÔNG BAO GIỜ gửi.
--
-- B3: process_incoming_bank_transfer multi-order branch không ghi finance
--     cho phần dư khi p_amount > total_outstanding → tiền mất khỏi sổ.
--
-- B4: Single-order branch insert tx amount=p_amount không clamp với
--     outstanding → overpay → tx ghi 10tr cho đơn nợ 7tr → trigger chỉ
--     allocate 7tr → sổ lệch 3tr.
--
-- C1: Multi-order loop không UPDATE payment_method='bank_transfer' trong
--     khi single-order có.
--
-- C4: EXCEPTION WHEN OTHERS NULL silently swallow — giờ đổi thành
--     RAISE WARNING để vào Postgres log (system_logs table chưa có).
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. notify_payment_received: Fix B1 + B2 + C4
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_paid_increased BOOLEAN;
  v_confirmed BOOLEAN;
  v_customer_name TEXT;
  v_delta numeric;
  v_remaining numeric;
  v_title TEXT;
  v_body TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_creator RECORD;
  v_portal_user RECORD;
BEGIN
  v_paid_increased := COALESCE(OLD.paid_amount, 0) < COALESCE(NEW.paid_amount, 0);
  v_confirmed := OLD.status = 'PENDING' AND NEW.status = 'CONFIRMED';

  IF NOT (v_paid_increased OR v_confirmed) THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.paid_amount, 0) - COALESCE(OLD.paid_amount, 0);
  v_remaining := GREATEST(NEW.final_amount - COALESCE(NEW.paid_amount, 0), 0);

  -- Customer name
  IF NEW.customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers_b2b WHERE id = NEW.customer_id;
  ELSIF NEW.customer_b2c_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_b2c_id;
  END IF;

  v_title := CASE
    WHEN v_confirmed THEN 'Đơn ' || NEW.code || ' đã thanh toán đủ'
    ELSE 'Đã nhận thanh toán cho đơn ' || NEW.code
  END;
  v_body := CASE
    WHEN v_confirmed THEN 'Đơn hàng ' || NEW.code || ' đã thanh toán đủ '
      || to_char(NEW.final_amount, 'FM999,999,999,999') || 'đ. Đội kho sẽ sớm chuẩn bị hàng.'
    ELSE 'Đã nhận ' || to_char(v_delta, 'FM999,999,999,999') || 'đ cho đơn ' || NEW.code
      || '. Còn thiếu: ' || to_char(v_remaining, 'FM999,999,999,999') || 'đ.'
  END;

  -- 1. B2B Portal notification (in-app cho KH)
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.b2b_notifications (customer_b2b_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'order_status',
      v_title,
      v_body,
      jsonb_build_object(
        'order_id', NEW.id, 'order_code', NEW.code,
        'event', CASE WHEN v_confirmed THEN 'payment_confirmed' ELSE 'payment_received' END,
        'amount', v_delta, 'paid_total', NEW.paid_amount,
        'final_amount', NEW.final_amount, 'remaining', v_remaining,
        'link', '/don-hang/' || NEW.code
      )
    );
  END IF;

  -- [B2 FIX] Đúng tên vault secret (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    RAISE WARNING 'notify_payment_received: không đọc được vault secret: %', SQLERRM;
  END;

  -- 2. Email KH (Portal users active)
  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
    FOR v_portal_user IN
      SELECT pu.email, pu.display_name
      FROM public.portal_users pu
      WHERE pu.customer_b2b_id = NEW.customer_id
        AND pu.status = 'active'
        AND pu.email IS NOT NULL AND pu.email <> ''
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'payment_received_customer',
            'email', v_portal_user.email,
            'data', jsonb_build_object(
              'business_name', COALESCE(v_customer_name, 'Quý khách'),
              'display_name', COALESCE(v_portal_user.display_name, v_customer_name),
              'order_code', NEW.code,
              'amount', v_delta::text,
              'total_paid', NEW.paid_amount,
              'final_amount', NEW.final_amount,
              'remaining_amount', v_remaining,
              'status_confirmed', v_confirmed
            )
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_payment_received: email KH fail, order=%, email=%, err=%',
          NEW.code, v_portal_user.email, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- 3. Notification + email cho NV KD (creator)
  IF NEW.creator_id IS NOT NULL THEN
    SELECT u.id AS user_id, u.email
    INTO v_creator
    FROM auth.users u WHERE u.id = NEW.creator_id;

    IF v_creator.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (
        v_creator.user_id,
        '[ERP] ' || v_title,
        COALESCE(v_customer_name, 'Khách lẻ') || ': ' || v_body,
        'payment',
        NEW.id::text
      );

      IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL
         AND v_creator.email IS NOT NULL AND v_creator.email <> '' THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-portal-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
              'type', 'payment_received_internal',
              'email', v_creator.email,
              'data', jsonb_build_object(
                'customer_name', COALESCE(v_customer_name, 'Khách lẻ'),
                'order_code', NEW.code,
                'amount', v_delta::text,
                'final_amount', NEW.final_amount,
                'remaining_amount', v_remaining,
                'status_confirmed', v_confirmed
              )
            ),
            timeout_milliseconds := 5000
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_payment_received: email NV KD fail, order=%, err=%', NEW.code, SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  -- [B1 FIX] 4. Warehouse users notification khi CONFIRMED — JOIN roles table
  IF v_confirmed THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    SELECT ur.user_id,
           'Đơn mới cần đóng hàng: ' || NEW.code,
           COALESCE(v_customer_name, 'Khách lẻ') || ' | ' ||
             to_char(NEW.final_amount, 'FM999,999,999,999') || 'đ',
           'warehouse_task',
           NEW.id::text
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name IN ('warehouse_admin', 'warehouse_staff')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. process_incoming_bank_transfer: Fix B3 + B4 + C1
-- ============================================================================
-- B3: Multi-order dư tiền → insert pending row cho phần thừa
-- B4: Single-order overpay → clamp amount = LEAST(p_amount, outstanding),
--     thừa insert pending row riêng
-- C1: Multi-order loop thêm UPDATE payment_method cho từng đơn

CREATE OR REPLACE FUNCTION public.process_incoming_bank_transfer(
  p_amount numeric, p_memo text, p_bank_ref_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_codes text[];
  v_code text;
  v_fund_id BIGINT;
  v_trans_code TEXT;
  v_partner_type TEXT;
  v_partner_id TEXT;
  v_partner_name TEXT;
  v_allocated_orders jsonb := '[]'::jsonb;
  v_alloc_amount numeric;
  v_remaining numeric := p_amount;
  v_total_outstanding numeric := 0;
  v_outstanding numeric;
  v_single_outstanding numeric;
  v_single_alloc numeric;
  v_excess numeric;
BEGIN
  IF p_bank_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_transactions WHERE bank_reference_id = p_bank_ref_id
  ) THEN
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'transaction_already_processed');
  END IF;

  SELECT id INTO v_fund_id FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  v_codes := public.extract_order_codes_from_memo(p_memo);

  IF array_length(v_codes, 1) IS NULL OR array_length(v_codes, 1) = 0 THEN
    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      description, status, bank_reference_id
    ) VALUES (
      v_trans_code, p_amount, 'in', 'other', v_fund_id,
      'Tiền vào chưa rõ đơn. Nội dung gốc: ' || COALESCE(p_memo, '(rỗng)'), 'pending', p_bank_ref_id
    );
    RETURN jsonb_build_object('status', 'saved_unallocated', 'message', 'Không tìm thấy mã đơn trong memo.');
  END IF;

  SELECT COALESCE(SUM(GREATEST(final_amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO v_total_outstanding
  FROM public.orders
  WHERE code = ANY(v_codes)
    AND payment_status != 'paid'
    AND status != 'CANCELLED';

  -- SINGLE-ORDER branch
  IF array_length(v_codes, 1) = 1 OR v_total_outstanding = 0 THEN
    v_code := v_codes[1];
    SELECT o.id, o.code, o.customer_id, o.customer_b2c_id,
           GREATEST(o.final_amount - COALESCE(o.paid_amount, 0), 0) AS outstanding,
           cb.name AS b2b_name, cc.name AS b2c_name
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE o.code = v_code
    LIMIT 1;

    IF v_order.id IS NULL THEN
      v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        description, status, bank_reference_id
      ) VALUES (
        v_trans_code, p_amount, 'in', 'other', v_fund_id,
        'Memo có mã ' || v_code || ' nhưng đơn không tồn tại. ND gốc: ' || COALESCE(p_memo, ''),
        'pending', p_bank_ref_id
      );
      RETURN jsonb_build_object('status', 'saved_unallocated', 'reason', 'order_not_found', 'code', v_code);
    END IF;

    v_single_outstanding := COALESCE(v_order.outstanding, 0);
    -- [B4 FIX] Clamp alloc = LEAST(p_amount, outstanding); dư phần thừa
    v_single_alloc := CASE
      WHEN v_single_outstanding > 0 THEN LEAST(p_amount, v_single_outstanding)
      ELSE 0
    END;
    v_excess := p_amount - v_single_alloc;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    -- Tx chính — amount đúng với outstanding (trigger auto_allocate sẽ không lệch)
    IF v_single_alloc > 0 THEN
      v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        partner_type, partner_id, partner_name_cache,
        ref_type, ref_id, description, status, bank_reference_id
      ) VALUES (
        v_trans_code, v_single_alloc, 'in', 'trade', v_fund_id,
        v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
        'order', v_order.code,
        'Hệ thống tự động gạch nợ. ND gốc: ' || COALESCE(p_memo, ''),
        'completed', p_bank_ref_id
      );
      UPDATE public.orders SET payment_method = 'bank_transfer' WHERE id = v_order.id;
      v_allocated_orders := v_allocated_orders || jsonb_build_array(
        jsonb_build_object('order_code', v_order.code, 'amount', v_single_alloc, 'trans_code', v_trans_code)
      );
    END IF;

    -- Tx dư (nếu có) — status='pending' cho kế toán tra soát
    IF v_excess > 0 THEN
      v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        partner_type, partner_id, partner_name_cache,
        description, status, bank_reference_id
      ) VALUES (
        v_trans_code, v_excess, 'in', 'other', v_fund_id,
        v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
        'Dư sau gạch nợ đơn ' || v_order.code || '. ND gốc: ' || COALESCE(p_memo, ''),
        'pending',
        p_bank_ref_id || '-excess'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'success',
      'allocated', v_allocated_orders,
      'excess', v_excess
    );
  END IF;

  -- MULTI-ORDER branch
  FOR v_order IN
    SELECT o.id, o.code, o.customer_id, o.customer_b2c_id,
           GREATEST(o.final_amount - COALESCE(o.paid_amount, 0), 0) AS outstanding,
           cb.name AS b2b_name, cc.name AS b2c_name
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE o.code = ANY(v_codes)
      AND o.payment_status != 'paid'
      AND o.status != 'CANCELLED'
    ORDER BY o.created_at ASC
  LOOP
    v_outstanding := v_order.outstanding;
    v_alloc_amount := LEAST(v_remaining, round(p_amount * v_outstanding / v_total_outstanding));
    IF v_alloc_amount <= 0 THEN CONTINUE; END IF;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      partner_type, partner_id, partner_name_cache,
      ref_type, ref_id, description, status, bank_reference_id
    ) VALUES (
      v_trans_code, v_alloc_amount, 'in', 'trade', v_fund_id,
      v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
      'order', v_order.code,
      'Hệ thống tự động gạch nợ (multi-order). ND gốc: ' || COALESCE(p_memo, ''),
      'completed', p_bank_ref_id || '-' || v_order.code
    );
    -- [C1 FIX] Update payment_method cho mỗi đơn trong loop
    UPDATE public.orders SET payment_method = 'bank_transfer' WHERE id = v_order.id;

    v_remaining := v_remaining - v_alloc_amount;
    v_allocated_orders := v_allocated_orders || jsonb_build_array(
      jsonb_build_object('order_code', v_order.code, 'amount', v_alloc_amount, 'trans_code', v_trans_code)
    );
  END LOOP;

  -- [B3 FIX] Ghi phần dư (nếu khách CK nhiều hơn tổng outstanding)
  IF v_remaining > 0 THEN
    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      description, status, bank_reference_id
    ) VALUES (
      v_trans_code, v_remaining, 'in', 'other', v_fund_id,
      'Dư sau gạch nợ multi-order (' || array_to_string(v_codes, ',') || '). ND gốc: ' || COALESCE(p_memo, ''),
      'pending',
      p_bank_ref_id || '-remainder'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'allocated', v_allocated_orders,
    'excess', v_remaining
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
