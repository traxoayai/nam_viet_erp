-- Portal Cart Items — giỏ hàng per portal_user, lưu DB
-- Date: 2026-04-15

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES public.products(id),
  quantity        INT NOT NULL CHECK (quantity > 0),
  uom             TEXT NOT NULL,
  unit_price      NUMERIC NOT NULL,
  conversion_factor INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portal_user_id, product_id, uom)
);

ALTER TABLE public.portal_cart_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.portal_cart_items IS 'Giỏ hàng Portal — mỗi portal_user có giỏ riêng';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_cart_user
  ON public.portal_cart_items (portal_user_id);

CREATE INDEX IF NOT EXISTS idx_portal_cart_product
  ON public.portal_cart_items (product_id);

-- RLS: user chỉ CRUD giỏ của mình
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_cart_items'
      AND policyname = 'cart_select_own'
  ) THEN
    CREATE POLICY "cart_select_own" ON public.portal_cart_items
      FOR SELECT TO authenticated
      USING (
        portal_user_id = (
          SELECT pu.id FROM public.portal_users pu
          WHERE pu.auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_cart_items'
      AND policyname = 'cart_insert_own'
  ) THEN
    CREATE POLICY "cart_insert_own" ON public.portal_cart_items
      FOR INSERT TO authenticated
      WITH CHECK (
        portal_user_id = (
          SELECT pu.id FROM public.portal_users pu
          WHERE pu.auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_cart_items'
      AND policyname = 'cart_update_own'
  ) THEN
    CREATE POLICY "cart_update_own" ON public.portal_cart_items
      FOR UPDATE TO authenticated
      USING (
        portal_user_id = (
          SELECT pu.id FROM public.portal_users pu
          WHERE pu.auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_cart_items'
      AND policyname = 'cart_delete_own'
  ) THEN
    CREATE POLICY "cart_delete_own" ON public.portal_cart_items
      FOR DELETE TO authenticated
      USING (
        portal_user_id = (
          SELECT pu.id FROM public.portal_users pu
          WHERE pu.auth_user_id = auth.uid() LIMIT 1
        )
      );
  END IF;
END
$$;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_cart_items'
      AND policyname = 'cart_service_all'
  ) THEN
    CREATE POLICY "cart_service_all" ON public.portal_cart_items
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.fn_portal_cart_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_portal_cart_updated_at'
      AND c.relname = 'portal_cart_items'
      AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER trg_portal_cart_updated_at
      BEFORE UPDATE ON public.portal_cart_items
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_portal_cart_updated_at();
  END IF;
END
$$;

COMMIT;
