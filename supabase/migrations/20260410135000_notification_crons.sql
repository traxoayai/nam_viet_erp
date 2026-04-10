-- =============================================================================
-- Debt Reminder Cron Jobs
-- Ngay tao: 2026-04-10
-- Mo ta: Cron jobs tu dong gui thong bao nhac cong no sap den han va qua han
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. FUNCTION: check_debt_due_soon
-- Kiem tra cong no den han trong 3 ngay toi
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_debt_due_soon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT d.customer_b2b_id,
           sum(d.remaining_amount) AS total_amount,
           min(d.due_date) AS earliest_due
    FROM b2b_customer_debt_view d
    WHERE d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      AND d.remaining_amount > 0
    GROUP BY d.customer_b2b_id
  LOOP
    -- Chi tao 1 thong bao/ngay/khach hang de tranh spam
    IF NOT EXISTS (
      SELECT 1 FROM b2b_notifications
      WHERE customer_b2b_id = r.customer_b2b_id
        AND type = 'debt_reminder'
        AND created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO b2b_notifications (customer_b2b_id, type, title, body, data)
      VALUES (
        r.customer_b2b_id,
        'debt_reminder',
        'Cong no sap den han: ' || to_char(r.total_amount, 'FM999,999,999') || 'd',
        'Ban co cong no ' || to_char(r.total_amount, 'FM999,999,999') || 'd sap den han ngay ' || to_char(r.earliest_due, 'DD/MM/YYYY') || '.',
        jsonb_build_object('link', '/cong-no')
      );
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- 2. FUNCTION: check_debt_overdue
-- Kiem tra cong no da qua han
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_debt_overdue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT d.customer_b2b_id,
           sum(d.remaining_amount) AS total_amount,
           min(d.due_date) AS earliest_due,
           (CURRENT_DATE - min(d.due_date)) AS days_overdue
    FROM b2b_customer_debt_view d
    WHERE d.due_date < CURRENT_DATE
      AND d.remaining_amount > 0
    GROUP BY d.customer_b2b_id
  LOOP
    -- Chi tao 1 thong bao/ngay/khach hang de tranh spam
    IF NOT EXISTS (
      SELECT 1 FROM b2b_notifications
      WHERE customer_b2b_id = r.customer_b2b_id
        AND type = 'debt_reminder'
        AND created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO b2b_notifications (customer_b2b_id, type, title, body, data)
      VALUES (
        r.customer_b2b_id,
        'debt_reminder',
        'Cong no qua han: ' || to_char(r.total_amount, 'FM999,999,999') || 'd',
        'Ban co cong no ' || to_char(r.total_amount, 'FM999,999,999') || 'd da qua han ' || r.days_overdue || ' ngay.',
        jsonb_build_object('link', '/cong-no')
      );
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- 3. SCHEDULE CRON JOBS (pg_cron extension)
-- 01:00 UTC = 08:00 Vietnam time
-- =============================================================================

SELECT cron.schedule('check-debt-due-soon', '0 1 * * *', $$SELECT check_debt_due_soon()$$);
SELECT cron.schedule('check-debt-overdue', '5 1 * * *', $$SELECT check_debt_overdue()$$);

COMMIT;
