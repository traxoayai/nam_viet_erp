-- =============================================================================
-- RPC: sync_viettel_provinces()
-- Mục đích: Upsert provinces from Viettel API response into provinces table
-- Input: provinces_data = JSON array [{code, name, delivery_time}, ...]
-- Returns: {synced_count, updated_count, error_count, last_synced_at}
-- Security: Service role only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_viettel_provinces(
  p_provinces_data JSON DEFAULT NULL
)
RETURNS TABLE(
  synced_count INTEGER,
  updated_count INTEGER,
  error_count INTEGER,
  last_synced_at TIMESTAMPTZ
) AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_province RECORD;
  v_sync_timestamp TIMESTAMPTZ := now();
BEGIN
  -- If no data provided, use mock data (for testing)
  IF p_provinces_data IS NULL THEN
    p_provinces_data := json_build_array(
      json_build_object('code', '100', 'name', 'Hà Nội', 'delivery_time', 1),
      json_build_object('code', '101', 'name', 'Hải Phòng', 'delivery_time', 2),
      json_build_object('code', '200', 'name', 'TP. Hồ Chí Minh', 'delivery_time', 1),
      json_build_object('code', '201', 'name', 'Bình Dương', 'delivery_time', 2),
      json_build_object('code', '202', 'name', 'Đồng Nai', 'delivery_time', 2)
    );
  END IF;

  -- Iterate through provinces array
  FOR v_province IN
    SELECT
      (elem->>'code')::TEXT AS code,
      (elem->>'name')::TEXT AS name,
      (elem->>'delivery_time')::INTEGER AS delivery_time
    FROM json_array_elements(p_provinces_data) AS elem
  LOOP
    BEGIN
      -- UPSERT: insert or update
      INSERT INTO public.provinces (
        province_code,
        province_name,
        delivery_time_std,
        last_synced_at
      ) VALUES (
        v_province.code,
        v_province.name,
        v_province.delivery_time,
        v_sync_timestamp
      )
      ON CONFLICT (province_code) DO UPDATE SET
        province_name = EXCLUDED.province_name,
        delivery_time_std = EXCLUDED.delivery_time_std,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = now();

      -- Check if this was an insert or update
      -- New rows: created_at ≈ updated_at ≈ now
      -- Updated rows: updated_at > created_at
      -- For now, count all as synced, track updates separately
      IF (SELECT updated_at - created_at FROM public.provinces WHERE province_code = v_province.code) > interval '0 seconds' THEN
        v_updated_count := v_updated_count + 1;
      ELSE
        v_synced_count := v_synced_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
    END;
  END LOOP;

  -- Return sync results
  RETURN QUERY SELECT v_synced_count, v_updated_count, v_error_count, v_sync_timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to service role
GRANT EXECUTE ON FUNCTION public.sync_viettel_provinces(JSON) TO service_role;

-- Optional: Add a version without parameters for cron jobs
CREATE OR REPLACE FUNCTION public.sync_viettel_provinces_no_args()
RETURNS TABLE(
  synced_count INTEGER,
  updated_count INTEGER,
  error_count INTEGER,
  last_synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.sync_viettel_provinces(NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_viettel_provinces_no_args() TO service_role;
