-- Fix: log_system_action() crash khi bang khong co cot "id" (vd: system_settings dung "key")
-- Chuyen tu NEW.id truc tiep sang trich tu JSONB voi fallback
-- 2026-04-12

BEGIN;

CREATE OR REPLACE FUNCTION "public"."log_system_action"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT := 'Hệ thống';
    v_record_id TEXT;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    v_user_id := auth.uid();

    -- Lấy tên User ngay tại thời điểm thực hiện thao tác (Snapshot)
    IF v_user_id IS NOT NULL THEN
        SELECT COALESCE(full_name, email, 'Chưa cập nhật tên') INTO v_user_name
        FROM public.users WHERE id = v_user_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := COALESCE(v_new_data->>'id', v_new_data->>'key', 'unknown');
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := COALESCE(v_new_data->>'id', v_new_data->>'key', 'unknown');
        IF v_old_data = v_new_data THEN RETURN NEW; END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := COALESCE(v_old_data->>'id', v_old_data->>'key', 'unknown');
    END IF;

    INSERT INTO public.system_logs (user_id, user_name, module, action, record_id, old_data, new_data)
    VALUES (v_user_id, v_user_name, TG_TABLE_NAME, TG_OP, v_record_id, v_old_data, v_new_data);

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Re-enable trigger da bi disable truoc do
ALTER TABLE public.system_settings ENABLE TRIGGER trg_log_system_settings;

COMMIT;
