-- Migration: Drop duplicate create_sales_order overload (p_delivery_time TEXT)
-- Giữ lại version mới: p_delivery_time TIMESTAMPTZ + p_source TEXT
-- Date: 2026-04-14

DROP FUNCTION IF EXISTS public.create_sales_order(
  JSONB, BIGINT, BIGINT, BIGINT, TEXT, TEXT, NUMERIC, NUMERIC, BIGINT, TEXT, TEXT,
  TEXT,  -- p_delivery_time TEXT  ← overload cũ
  TEXT, BIGINT, TEXT, TEXT
);

NOTIFY pgrst, 'reload schema';
