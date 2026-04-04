-- Thêm column receipt_draft + function save_inbound_draft
-- Đồng bộ từ production (function được tạo thủ công trước đó)

-- 1. Thêm column receipt_draft vào purchase_orders (nếu chưa có)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS receipt_draft JSONB DEFAULT '{}'::jsonb;

-- 2. Tạo function save_inbound_draft
CREATE OR REPLACE FUNCTION public.save_inbound_draft(p_po_id bigint, p_draft_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.purchase_orders
    SET receipt_draft = p_draft_data,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã lưu nháp tiến độ kiểm hàng.'
    );
END;
$$;
