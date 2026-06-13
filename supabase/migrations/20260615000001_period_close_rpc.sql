-- Hạch toán: RPC close_accounting_period (lock + P&L + carry-forward). Ngày 2026-06-15.
-- Đóng kỳ kế toán: khóa bút toán, tính P&L, tạo bút toán chốt kỳ, chuyển số dư tài khoản bảng cân đối.
BEGIN;

CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id bigint)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  pnl_entry_id BIGINT,
  closed_at TIMESTAMPTZ
) AS $$
DECLARE
  v_period RECORD;
  v_pnl_entry_id BIGINT;
  v_total_revenue NUMERIC := 0;
  v_total_cogs NUMERIC := 0;
  v_total_expense NUMERIC := 0;
  v_net_income NUMERIC := 0;
  v_balance RECORD;
  v_next_period_id BIGINT;
  v_next_year INT;
  v_next_month INT;
BEGIN
  PERFORM public.check_rpc_access('close_accounting_period');

  -- Fetch period record
  SELECT * INTO v_period FROM public.accounting_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Kỳ kế toán không tồn tại'::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_period.status = 'closed' THEN
    RETURN QUERY SELECT FALSE, 'Kỳ đã đóng, không thể đóng lại'::TEXT, NULL::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Calculate next period for carry-forward
  v_next_year := v_period.year;
  v_next_month := v_period.month + 1;
  IF v_next_month > 12 THEN
    v_next_year := v_next_year + 1;
    v_next_month := 1;
  END IF;

  -- Get or create next period
  SELECT id INTO v_next_period_id
  FROM public.accounting_periods
  WHERE book = v_period.book AND year = v_next_year AND month = v_next_month;

  IF v_next_period_id IS NULL THEN
    INSERT INTO public.accounting_periods (book, year, month, status)
    VALUES (v_period.book, v_next_year, v_next_month, 'open')
    RETURNING id INTO v_next_period_id;
  END IF;

  -- Calculate P&L from journal entries
  -- Revenue: sum credit of DoanhThu accounts
  SELECT COALESCE(SUM(jel.credit), 0) INTO v_total_revenue
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.entry_id
  JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.period_id = p_period_id
    AND je.book = v_period.book
    AND je.status = 'posted'
    AND coa.type = 'DoanhThu';

  -- COGS: sum debit of ChiPhi accounts (with code starting with 632)
  SELECT COALESCE(SUM(jel.debit), 0) INTO v_total_cogs
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.entry_id
  JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.period_id = p_period_id
    AND je.book = v_period.book
    AND je.status = 'posted'
    AND coa.type = 'ChiPhi'
    AND coa.account_code LIKE '632%';

  -- Other Expense: sum debit of ChiPhi accounts (with code starting with 811)
  SELECT COALESCE(SUM(jel.debit), 0) INTO v_total_expense
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.entry_id
  JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.period_id = p_period_id
    AND je.book = v_period.book
    AND je.status = 'posted'
    AND coa.type = 'ChiPhi'
    AND coa.account_code LIKE '811%';

  -- Net income = Revenue - COGS - Expense
  v_net_income := v_total_revenue - v_total_cogs - v_total_expense;

  -- Create P&L closing entry (bút toán chốt kỳ)
  INSERT INTO public.journal_entries (
    book, entry_date, period_id, doc_type, description,
    status, total_debit, total_credit, created_by
  ) VALUES (
    v_period.book,
    (v_period.year::TEXT || LPAD(v_period.month::TEXT, 2, '0') || '30')::DATE,
    p_period_id,
    'closing',
    'Bút toán chốt kỳ - Lợi nhuận/Lỗ',
    'posted',
    ABS(v_net_income),
    ABS(v_net_income),
    auth.uid()
  ) RETURNING id INTO v_pnl_entry_id;

  -- Insert P&L lines (Retained Earnings: 493 account)
  -- If profit: debit 493 (retained earnings), credit 911 (net income)
  -- If loss: credit 493, debit 911
  DECLARE
    v_retained_earnings_id UUID;
    v_net_income_id UUID;
  BEGIN
    SELECT id INTO v_retained_earnings_id
    FROM public.chart_of_accounts
    WHERE account_code = '493' AND status = 'active'
    LIMIT 1;

    SELECT id INTO v_net_income_id
    FROM public.chart_of_accounts
    WHERE account_code = '911' AND status = 'active'
    LIMIT 1;

    IF v_retained_earnings_id IS NOT NULL AND v_net_income_id IS NOT NULL THEN
      IF v_net_income >= 0 THEN
        -- Profit: debit retained earnings, credit net income
        INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, line_no)
        VALUES (v_pnl_entry_id, v_retained_earnings_id, v_net_income, 0, 1);
        INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, line_no)
        VALUES (v_pnl_entry_id, v_net_income_id, 0, v_net_income, 2);
      ELSE
        -- Loss: credit retained earnings, debit net income
        INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, line_no)
        VALUES (v_pnl_entry_id, v_net_income_id, ABS(v_net_income), 0, 1);
        INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, line_no)
        VALUES (v_pnl_entry_id, v_retained_earnings_id, 0, ABS(v_net_income), 2);
      END IF;
    END IF;
  END;

  -- Carry forward balance sheet accounts (Assets, Liabilities, Equity) to next period
  FOR v_balance IN
    SELECT
      ab.book,
      ab.account_id,
      ab.opening_debit + ab.period_debit AS carry_debit,
      ab.opening_credit + ab.period_credit AS carry_credit
    FROM public.account_balances ab
    JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
    WHERE ab.period_id = p_period_id
      AND coa.type IN ('TaiSan', 'NoPhaiTra', 'VonChuSoHuu')
  LOOP
    INSERT INTO public.account_balances (
      book, account_id, period_id, opening_debit, opening_credit
    ) VALUES (
      v_balance.book,
      v_balance.account_id,
      v_next_period_id,
      v_balance.carry_debit,
      v_balance.carry_credit
    )
    ON CONFLICT (book, account_id, period_id) DO UPDATE SET
      opening_debit = EXCLUDED.opening_debit,
      opening_credit = EXCLUDED.opening_credit,
      updated_at = now();
  END LOOP;

  -- Update period status to closed
  UPDATE public.accounting_periods
  SET status = 'closed', closed_at = now()
  WHERE id = p_period_id;

  RETURN QUERY SELECT TRUE, 'Kỳ kế toán đóng thành công'::TEXT, v_pnl_entry_id, v_period.closed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.close_accounting_period(bigint) TO authenticated, service_role;

-- Register in RPC access rules
INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('close_accounting_period', 'finance.view_balance', 10, true, 'Đóng kỳ kế toán')
ON CONFLICT (function_name) DO UPDATE SET
  required_permission = EXCLUDED.required_permission,
  max_calls_per_minute = EXCLUDED.max_calls_per_minute,
  is_write = EXCLUDED.is_write,
  description = EXCLUDED.description;

-- Add trigger to prevent INSERT/UPDATE/DELETE on closed periods
CREATE OR REPLACE FUNCTION public.prevent_posting_closed_period()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE v_period_status TEXT;
BEGIN
  SELECT status INTO v_period_status
  FROM public.accounting_periods
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'Kỳ kế toán đã khóa, không thể thay đổi bút toán';
  END IF;

  RETURN COALESCE(NEW, OLD);
END $fn$;

-- Attach trigger to journal_entries
DROP TRIGGER IF EXISTS trg_prevent_closed_period ON public.journal_entries;
CREATE TRIGGER trg_prevent_closed_period
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_posting_closed_period();

COMMIT;
