-- Seed: Gán full quyền (admin-all) cho admin@test.com trên local
-- Chỉ dùng cho local development, KHÔNG deploy lên production

DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_branch_id BIGINT;
BEGIN
  -- 1. Tìm user admin@test.com trong auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User admin@test.com chua ton tai trong auth.users. Tao user truoc.';
    -- Tạo user qua auth (Supabase local)
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token,
      email_change, email_change_token_new, email_change_token_current,
      email_change_confirm_status, phone, phone_change, phone_change_token,
      recovery_token, reauthentication_token, is_sso_user, is_anonymous
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'admin@test.com',
      crypt('Admin@938!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Test"}'::jsonb,
      'authenticated', 'authenticated', '',
      '', '', '', 0, '', '', '', '', '', false, false
    )
    RETURNING id INTO v_user_id;
    RAISE NOTICE 'Da tao user admin@test.com: %', v_user_id;
  ELSE
    RAISE NOTICE 'User admin@test.com da ton tai: %', v_user_id;
  END IF;

  -- 1b. Dam bao identity ton tai (GoTrue can identity de login)
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_user_id, v_user_id, 'admin@test.com',
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@test.com', 'email_verified', true),
    'email', NOW(), NOW(), NOW()
  ) ON CONFLICT DO NOTHING;

  -- 2. Dam bao user co profile trong public.users
  INSERT INTO public.users (id, full_name, status, created_at, profile_updated_at)
  VALUES (v_user_id, 'Admin Test', 'active', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET status = 'active', full_name = COALESCE(public.users.full_name, 'Admin Test'), profile_updated_at = COALESCE(public.users.profile_updated_at, NOW());

  -- 3. Dam bao permission admin-all ton tai
  INSERT INTO public.permissions (key, name, module)
  VALUES ('admin-all', 'Full Admin Access', 'admin')
  ON CONFLICT (key) DO NOTHING;

  -- 4. Tao role Admin neu chua co
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Admin' LIMIT 1;
  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (name, description)
    VALUES ('Admin', 'Full access - all permissions')
    RETURNING id INTO v_role_id;
    RAISE NOTICE 'Da tao role Admin: %', v_role_id;
  ELSE
    RAISE NOTICE 'Role Admin da ton tai: %', v_role_id;
  END IF;

  -- 5. Gan permission admin-all cho role Admin
  INSERT INTO public.role_permissions (role_id, permission_key)
  VALUES (v_role_id, 'admin-all')
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- 6. Tim branch (warehouse) dau tien lam default
  SELECT id INTO v_branch_id FROM public.warehouses LIMIT 1;
  IF v_branch_id IS NULL THEN
    INSERT INTO public.warehouses (key, name, unit, type, status)
    VALUES ('main', 'Chi nhanh chinh', 'main', 'store', 'active')
    RETURNING id INTO v_branch_id;
    RAISE NOTICE 'Da tao warehouse mac dinh: %', v_branch_id;
  END IF;

  -- 7. Gan role Admin cho user admin@test.com
  INSERT INTO public.user_roles (user_id, role_id, branch_id)
  VALUES (v_user_id, v_role_id, v_branch_id)
  ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

  RAISE NOTICE '=== DONE: admin@test.com da co full quyen (admin-all) ===';
END;
$$;
