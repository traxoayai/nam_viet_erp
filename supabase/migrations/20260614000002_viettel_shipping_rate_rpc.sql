-- RPC functions for Viettel Post shipping rate integration
-- These functions handle rate calculation, caching, and API integration

-- Function: calculate_shipping_rate
-- Purpose: Get shipping rate from cache or call external API, then cache result
-- Returns: JSON with rate details or error info
-- Security: Service role only
CREATE OR REPLACE FUNCTION public.calculate_shipping_rate(
  p_send_province TEXT,
  p_receive_province TEXT,
  p_weight INTEGER,
  p_service_id TEXT DEFAULT 'VTP',
  p_declared_value INTEGER DEFAULT NULL,
  p_customer_code TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_cached_rate RECORD;
  v_response JSON;
  v_api_url TEXT;
  v_api_key TEXT;
  v_request_body JSON;
  v_http_response JSON;
  v_ttl INTEGER;
  v_cache_id UUID;
BEGIN
  -- Validate inputs
  IF p_weight <= 0 THEN
    RETURN json_build_object(
      'status', 'error',
      'error_type', 'INVALID_WEIGHT',
      'message', 'Weight must be greater than 0',
      'shipping_fee', 0,
      'insurance_fee', 0,
      'total_fee', 0,
      'estimated_days', NULL,
      'service_name', NULL
    );
  END IF;

  -- Check cache first (look for non-expired entries)
  SELECT *
  INTO v_cached_rate
  FROM public.shipping_rate_cache
  WHERE send_province = p_send_province
    AND receive_province = p_receive_province
    AND weight = p_weight
    AND service_id = p_service_id
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  -- If cache hit, return cached result
  IF v_cached_rate IS NOT NULL THEN
    RETURN json_build_object(
      'status', 'success',
      'source', 'cache',
      'shipping_fee', v_cached_rate.shipping_fee,
      'insurance_fee', v_cached_rate.insurance_fee,
      'total_fee', v_cached_rate.total_fee,
      'estimated_days', v_cached_rate.estimated_days,
      'service_name', v_cached_rate.service_name,
      'cache_ttl', v_cached_rate.cache_ttl
    );
  END IF;

  -- API is mocked for now — will integrate with real Viettel API later
  -- For current implementation, return fallback calculation
  v_response := json_build_object(
    'status', 'success',
    'source', 'api',
    'shipping_fee', (p_weight / 100) * 5000 + 20000, -- Simplified calculation
    'insurance_fee', CASE WHEN p_declared_value > 0 THEN GREATEST((p_declared_value / 100), 5000) ELSE 0 END,
    'total_fee', (p_weight / 100) * 5000 + 20000 + GREATEST((COALESCE(p_declared_value, 0) / 100), 0),
    'estimated_days', CASE WHEN p_service_id = 'VTX' THEN 1 ELSE 3 END,
    'service_name', CASE
      WHEN p_service_id = 'VTX' THEN 'Vận chuyển nhanh'
      WHEN p_service_id = 'VTL' THEN 'Vận chuyển tủ quỹ'
      ELSE 'Vận chuyển tiêu chuẩn'
    END,
    'cache_ttl', 3600
  );

  -- Cache the response
  BEGIN
    INSERT INTO public.shipping_rate_cache (
      send_province,
      receive_province,
      weight,
      service_id,
      shipping_fee,
      insurance_fee,
      total_fee,
      estimated_days,
      service_name,
      cache_ttl,
      fetched_at,
      expires_at
    ) VALUES (
      p_send_province,
      p_receive_province,
      p_weight,
      p_service_id,
      (v_response->>'shipping_fee')::INTEGER,
      (v_response->>'insurance_fee')::INTEGER,
      (v_response->>'total_fee')::INTEGER,
      (v_response->>'estimated_days')::INTEGER,
      v_response->>'service_name',
      3600,
      now(),
      now() + interval '1 hour'
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- If cache insertion fails, still return the rate to client
    NULL;
  END;

  RETURN v_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_cached_shipping_rate
-- Purpose: Retrieve a single cached rate entry
-- Returns: Shipping rate cache record or NULL
CREATE OR REPLACE FUNCTION public.get_cached_shipping_rate(
  p_send_province TEXT,
  p_receive_province TEXT,
  p_weight INTEGER,
  p_service_id TEXT DEFAULT 'VTP'
)
RETURNS TABLE(
  id UUID,
  send_province TEXT,
  receive_province TEXT,
  weight INTEGER,
  service_id TEXT,
  shipping_fee INTEGER,
  insurance_fee INTEGER,
  total_fee INTEGER,
  estimated_days INTEGER,
  service_name TEXT,
  cache_ttl INTEGER,
  fetched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    src.id,
    src.send_province,
    src.receive_province,
    src.weight,
    src.service_id,
    src.shipping_fee,
    src.insurance_fee,
    src.total_fee,
    src.estimated_days,
    src.service_name,
    src.cache_ttl,
    src.fetched_at,
    src.expires_at,
    src.created_at,
    src.updated_at
  FROM public.shipping_rate_cache src
  WHERE src.send_province = p_send_province
    AND src.receive_province = p_receive_province
    AND src.weight = p_weight
    AND src.service_id = p_service_id
    AND src.expires_at > now()
  ORDER BY src.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: save_shipping_rate_cache
-- Purpose: Manually save or update a shipping rate cache entry
-- Returns: Success status and cache entry ID
CREATE OR REPLACE FUNCTION public.save_shipping_rate_cache(
  p_send_province TEXT,
  p_receive_province TEXT,
  p_weight INTEGER,
  p_service_id TEXT,
  p_shipping_fee INTEGER,
  p_insurance_fee INTEGER,
  p_estimated_days INTEGER,
  p_service_name TEXT,
  p_cache_ttl INTEGER DEFAULT 3600
)
RETURNS JSON AS $$
DECLARE
  v_cache_id UUID;
BEGIN
  INSERT INTO public.shipping_rate_cache (
    send_province,
    receive_province,
    weight,
    service_id,
    shipping_fee,
    insurance_fee,
    total_fee,
    estimated_days,
    service_name,
    cache_ttl,
    fetched_at,
    expires_at
  ) VALUES (
    p_send_province,
    p_receive_province,
    p_weight,
    p_service_id,
    p_shipping_fee,
    p_insurance_fee,
    p_shipping_fee + p_insurance_fee,
    p_estimated_days,
    p_service_name,
    p_cache_ttl,
    now(),
    now() + (p_cache_ttl || ' seconds')::INTERVAL
  )
  ON CONFLICT (send_province, receive_province, weight, service_id)
  DO UPDATE SET
    shipping_fee = EXCLUDED.shipping_fee,
    insurance_fee = EXCLUDED.insurance_fee,
    total_fee = EXCLUDED.total_fee,
    estimated_days = EXCLUDED.estimated_days,
    service_name = EXCLUDED.service_name,
    fetched_at = now(),
    expires_at = now() + (EXCLUDED.cache_ttl || ' seconds')::INTERVAL,
    updated_at = now()
  RETURNING id INTO v_cache_id;

  RETURN json_build_object(
    'status', 'success',
    'cache_id', v_cache_id,
    'message', 'Shipping rate cached successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'status', 'error',
    'message', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: cleanup_expired_shipping_cache
-- Purpose: Remove expired cache entries
-- Returns: Number of deleted rows
CREATE OR REPLACE FUNCTION public.cleanup_expired_shipping_cache()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.shipping_rate_cache
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_shipping_rate TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cached_shipping_rate TO service_role;
GRANT EXECUTE ON FUNCTION public.save_shipping_rate_cache TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_shipping_cache TO service_role;
