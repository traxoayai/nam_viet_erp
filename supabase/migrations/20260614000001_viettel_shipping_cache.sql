-- Create shipping_rate_cache table for Viettel Post API response caching
-- Purpose: Cache shipping rates to reduce API calls and improve performance
-- TTL: 1 hour (configurable via cache_ttl column)

CREATE TABLE IF NOT EXISTS public.shipping_rate_cache (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request parameters (used for cache key lookup)
  send_province TEXT NOT NULL,
  receive_province TEXT NOT NULL,
  weight INTEGER NOT NULL, -- in grams
  service_id TEXT NOT NULL DEFAULT 'VTP',

  -- Response data
  shipping_fee INTEGER NOT NULL DEFAULT 0, -- in VND
  insurance_fee INTEGER NOT NULL DEFAULT 0, -- in VND
  total_fee INTEGER NOT NULL DEFAULT 0, -- in VND
  estimated_days INTEGER, -- nullable
  service_name TEXT,

  -- Cache metadata
  cache_ttl INTEGER NOT NULL DEFAULT 3600, -- TTL in seconds (default 1 hour)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_weight CHECK (weight > 0),
  CONSTRAINT valid_shipping_fee CHECK (shipping_fee >= 0),
  CONSTRAINT valid_insurance_fee CHECK (insurance_fee >= 0),
  CONSTRAINT valid_estimated_days CHECK (estimated_days IS NULL OR estimated_days > 0),
  CONSTRAINT valid_ttl CHECK (cache_ttl > 0)
);

-- Indexes for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_shipping_cache_lookup
  ON public.shipping_rate_cache(send_province, receive_province, weight, service_id);

CREATE INDEX IF NOT EXISTS idx_shipping_cache_expires
  ON public.shipping_rate_cache(expires_at)
  WHERE expires_at > now();

CREATE INDEX IF NOT EXISTS idx_shipping_cache_created
  ON public.shipping_rate_cache(created_at DESC);

-- Enable RLS
ALTER TABLE public.shipping_rate_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to read/write cache
CREATE POLICY "Allow service role full access to shipping cache"
  ON public.shipping_rate_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read cache only
CREATE POLICY "Allow authenticated users to read shipping cache"
  ON public.shipping_rate_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_shipping_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_rows INTEGER;
BEGIN
  DELETE FROM public.shipping_rate_cache
  WHERE expires_at <= now();

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at on cache entries
CREATE OR REPLACE FUNCTION update_shipping_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipping_cache_updated_at_trigger ON public.shipping_rate_cache;
CREATE TRIGGER shipping_cache_updated_at_trigger
  BEFORE UPDATE ON public.shipping_rate_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_cache_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rate_cache TO service_role;
GRANT SELECT ON public.shipping_rate_cache TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_shipping_cache TO service_role;
GRANT EXECUTE ON FUNCTION update_shipping_cache_timestamp TO service_role;
