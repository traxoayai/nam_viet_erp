DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  customer_id BIGINT;
BEGIN
  -- 1. Get an existing customer
  SELECT id INTO customer_id FROM public.customers_b2b LIMIT 1;
  
  IF customer_id IS NULL THEN
    RAISE EXCEPTION 'No customers found in public.customers_b2b. Please load data first.';
  END IF;

  -- 2. Delete existing if any (idempotent)
  DELETE FROM public.portal_users WHERE email = 'demo@namviet.com';
  DELETE FROM auth.users WHERE email = 'demo@namviet.com';

  -- 3. Create auth.user (password: password123)
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id)
  VALUES (
    new_user_id,
    'authenticated',
    'authenticated',
    'demo@namviet.com',
    -- password123
    '$2a$10$7v59xUAgfAnrD6yC4hZzUeDREp.6u6w8/HjXm.f8.6u8/HjXm.f8.', 
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000'
  );

  -- 4. Create public.portal_user
  INSERT INTO public.portal_users (auth_user_id, customer_b2b_id, email, display_name, role, status, created_at, updated_at)
  VALUES (
    new_user_id,
    customer_id,
    'demo@namviet.com',
    'Nam Việt Demo User',
    'owner',
    'active',
    now(),
    now()
  );

  RAISE NOTICE 'Test user created: demo@namviet.com / password123';
END $$;
