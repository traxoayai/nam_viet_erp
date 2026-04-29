-- RPC backfill: reprocess các tx pending bị fail bởi regex parser cũ
-- ============================================================================
-- TÌNH TRẠNG:
--   Migration 20260428100000 sửa regex bắt 8-digit. Các tx tạo TRƯỚC migration
--   đã ghi pending với description 'Memo có mã SO-YYMMDD-0000 nhưng đơn không
--   tồn tại. ND gốc: <memo>'. Cần reprocess để allocate.
--
-- THIẾT KẾ:
--   - Dry-run mặc định (p_dry_run=true): chỉ liệt kê candidate, KHÔNG ghi.
--   - Apply mode (p_dry_run=false): với mỗi tx candidate:
--     1. Extract memo gốc từ description ('ND gốc: <memo>').
--     2. Verify memo mới parse ra mã đơn TỒN TẠI.
--     3. Lưu bank_ref_id gốc, rename pending tx → '<orig>__superseded_<id>' để
--        gỡ idempotent guard (LIKE '<orig>-%' không match vì __ ≠ -).
--     4. Mark tx pending: status='cancelled' (enum không có 'voided'; dùng
--        'cancelled' + note backfill để audit).
--     5. Gọi process_incoming_bank_transfer(amount, memo_goc, ref_goc).
--     6. Nếu lỗi → rollback exception block, log vào v_errors.
--   - Idempotent: filter description NOT LIKE '%[BACKFILL%' và status='pending'.
--     Sau khi voided, lần chạy sau không quét lại.
-- Date: 2026-04-28
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reprocess_failed_bank_memos(
  p_dry_run boolean DEFAULT true,
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx RECORD;
  v_memo text;
  v_orig_ref text;
  v_codes text[];
  v_order_exists boolean;
  v_processed jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_rpc_result jsonb;
BEGIN
  FOR v_tx IN
    SELECT id, code, amount, description, bank_reference_id, status
    FROM public.finance_transactions
    WHERE status = 'pending'
      AND business_type = 'other'
      AND ref_id IS NULL
      AND bank_reference_id IS NOT NULL
      AND description ~ 'Memo có mã (SO|POS)-\d{6}-0000 nhưng đơn không tồn tại'
      AND description NOT LIKE '%[BACKFILL%'
    ORDER BY id ASC
    LIMIT p_limit
  LOOP
    -- Extract 'ND gốc: <memo>' (đến hết chuỗi)
    v_memo := substring(v_tx.description from 'ND gốc:\s*(.*)$');
    IF v_memo IS NULL OR btrim(v_memo) = '' THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'reason', 'missing_original_memo'
      ));
      CONTINUE;
    END IF;

    v_codes := public.extract_order_codes_from_memo(v_memo);
    IF array_length(v_codes, 1) IS NULL OR array_length(v_codes, 1) = 0 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'reason', 'still_no_match', 'memo', v_memo
      ));
      CONTINUE;
    END IF;

    -- Verify ít nhất 1 mã trong v_codes có order tồn tại
    SELECT EXISTS (
      SELECT 1 FROM public.orders WHERE code = ANY(v_codes)
    ) INTO v_order_exists;

    IF NOT v_order_exists THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'reason', 'orders_not_found',
        'codes', to_jsonb(v_codes)
      ));
      CONTINUE;
    END IF;

    IF p_dry_run THEN
      v_processed := v_processed || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'amount', v_tx.amount,
        'extracted_codes', to_jsonb(v_codes), 'memo', v_memo, 'mode', 'dry_run'
      ));
      CONTINUE;
    END IF;

    -- Apply mode: void tx cũ + reprocess
    BEGIN
      v_orig_ref := v_tx.bank_reference_id;

      UPDATE public.finance_transactions
      SET status = 'cancelled',
          bank_reference_id = v_orig_ref || '__superseded_' || v_tx.id,
          description = description || E'\n[BACKFILL 2026-04-28] Voided + reprocessed.'
      WHERE id = v_tx.id;

      v_rpc_result := public.process_incoming_bank_transfer(
        v_tx.amount,
        v_memo,
        v_orig_ref
      );

      v_processed := v_processed || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'amount', v_tx.amount,
        'rpc_result', v_rpc_result, 'mode', 'applied'
      ));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'tx_id', v_tx.id, 'code', v_tx.code, 'sqlstate', SQLSTATE, 'message', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'processed_count', jsonb_array_length(v_processed),
    'skipped_count', jsonb_array_length(v_skipped),
    'error_count', jsonb_array_length(v_errors),
    'processed', v_processed,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reprocess_failed_bank_memos(boolean, int)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
