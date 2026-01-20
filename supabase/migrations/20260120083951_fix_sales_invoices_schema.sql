-- Migration: 20260120_fix_sales_invoices_schema.sql
BEGIN;

    -- 1. Bổ sung cột Status (Quan trọng)
    ALTER TABLE public.sales_invoices 
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

    -- 2. Đánh Index cho cột status (Tối ưu tốc độ lọc đơn)
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON public.sales_invoices(status);

    -- 3. Ghi chú quy trình trạng thái (Documentation)
    COMMENT ON COLUMN public.sales_invoices.status IS 
    'pending: Mới tạo/Chờ xử lý
     processing: Đang xử lý (Kế toán đã tải file)
     issued: Đã phát hành (Trigger kích hoạt -> TRỪ KHO VAT)
     verified: Đã đối soát xong';

    -- 4. Cập nhật Trigger Logic (Re-apply để đảm bảo nhận diện cột mới)
    CREATE OR REPLACE FUNCTION "public"."trigger_deduct_vat_inventory"() 
    RETURNS "trigger" 
    LANGUAGE "plpgsql" SECURITY DEFINER 
    AS $$
    BEGIN
        -- Logic: Chỉ trừ kho khi trạng thái chuyển sang 'issued' hoặc 'verified'
        -- Và trạng thái cũ KHÔNG PHẢI là 'issued'/'verified' (để tránh trừ 2 lần)
        IF NEW.status IN ('issued', 'verified') 
           AND (OLD.status IS NULL OR OLD.status NOT IN ('issued', 'verified')) THEN
            
            PERFORM public.process_sales_invoice_deduction(NEW.id);
            
        END IF;
        RETURN NEW;
    END;
    $$;

    -- 5. Re-bind Trigger (Cho chắc chắn)
    DROP TRIGGER IF EXISTS "on_sales_invoice_issue" ON public.sales_invoices;
    CREATE TRIGGER "on_sales_invoice_issue"
    AFTER UPDATE ON public.sales_invoices
    FOR EACH ROW EXECUTE FUNCTION public.trigger_deduct_vat_inventory();

COMMIT;