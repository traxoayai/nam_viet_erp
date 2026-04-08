CREATE OR REPLACE FUNCTION public.approve_portal_registration(
  p_request_id UUID,
  p_existing_customer_id BIGINT DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL,
  p_debt_limit NUMERIC DEFAULT 50000000,
  p_payment_term INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_customer_id BIGINT;
  v_customer_code TEXT;
  v_portal_user_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  SELECT * INTO v_request
  FROM public.registration_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã được xử lý.';
  END IF;

  IF p_existing_customer_id IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers_b2b
    WHERE id = p_existing_customer_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Khách hàng B2B không tồn tại hoặc đã ngưng hoạt động.';
    END IF;
  ELSE
    SELECT 'B2B-' || LPAD((COALESCE(MAX(id), 0) + 1)::TEXT, 5, '0')
    INTO v_customer_code FROM public.customers_b2b;

    INSERT INTO public.customers_b2b (
      customer_code, name, phone, email, tax_code,
      vat_address, shipping_address, debt_limit, payment_term, status
    ) VALUES (
      v_customer_code, v_request.business_name, v_request.phone, v_request.email,
      v_request.tax_code, v_request.address, v_request.address,
      p_debt_limit, p_payment_term, 'active'
    ) RETURNING id INTO v_customer_id;
  END IF;

  IF p_auth_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = p_auth_user_id) THEN
      RAISE EXCEPTION 'Auth user này đã có portal account.';
    END IF;

    INSERT INTO public.portal_users (
      auth_user_id, customer_b2b_id, display_name, email, phone, role, status
    ) VALUES (
      p_auth_user_id, v_customer_id, v_request.contact_name,
      v_request.email, v_request.phone, 'owner', 'active'
    ) RETURNING id INTO v_portal_user_id;
  END IF;

  UPDATE public.registration_requests SET
    status = 'approved',
    approved_customer_b2b_id = v_customer_id,
    approved_portal_user_id = v_portal_user_id,
    approved_by = v_admin_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'customer_code', COALESCE(v_customer_code, (SELECT customer_code FROM customers_b2b WHERE id = v_customer_id)),
    'portal_user_id', v_portal_user_id,
    'auth_user_id', p_auth_user_id
  );
END;
$$;
