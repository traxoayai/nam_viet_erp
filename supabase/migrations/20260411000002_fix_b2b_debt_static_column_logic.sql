-- ============================================================
-- Fix B2B Debt Static Column Logic
-- 1. Cập nhật trigger để chỉ tính nợ từ trạng thái PACKED trở đi
-- 2. Xử lý INSERT/UPDATE/DELETE đồng nhất
-- 3. Đồng bộ lại dữ liệu hiện tại cho khớp với VIEW
-- Ngày: 2026-04-09
-- ============================================================

BEGIN;

-- 1. Định nghĩa lại hàm trigger cập nhật nợ từ Đơn hàng (Orders)
CREATE OR REPLACE FUNCTION public.fn_trigger_update_debt_from_orders()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_is_debt_status_old BOOLEAN;
    v_is_debt_status_new BOOLEAN;
BEGIN
    -- Chỉ xử lý đơn có customer_id (B2B)
    -- NEW.customer_id cho INSERT/UPDATE, OLD.customer_id cho DELETE
    
    -- Danh sách trạng thái tính nợ: PACKED, SHIPPING, DELIVERED, COMPLETED
    -- (Trạng thái CONFIRMED không tính nợ theo yêu cầu)

    -- [Xử lý DELETE]
    IF (TG_OP = 'DELETE') THEN
        IF OLD.customer_id IS NOT NULL THEN
            v_is_debt_status_old := (OLD.status IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED'));
            IF v_is_debt_status_old THEN
                UPDATE public.customers_b2b
                SET current_debt = COALESCE(current_debt, 0) - OLD.final_amount
                WHERE id = OLD.customer_id;
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    -- [Xử lý INSERT]
    IF (TG_OP = 'INSERT') THEN
        IF NEW.customer_id IS NOT NULL THEN
            v_is_debt_status_new := (NEW.status IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED'));
            IF v_is_debt_status_new THEN
                UPDATE public.customers_b2b
                SET current_debt = COALESCE(current_debt, 0) + NEW.final_amount
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- [Xử lý UPDATE]
    IF (TG_OP = 'UPDATE') THEN
        IF NEW.customer_id IS NOT NULL THEN
            v_is_debt_status_old := (OLD.status IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED'));
            v_is_debt_status_new := (NEW.status IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED'));

            -- Case 1: Chuyển từ trạng thái KHÔNG nợ -> CÓ nợ
            IF NOT v_is_debt_status_old AND v_is_debt_status_new THEN
                UPDATE public.customers_b2b
                SET current_debt = COALESCE(current_debt, 0) + NEW.final_amount
                WHERE id = NEW.customer_id;
            
            -- Case 2: Chuyển từ trạng thái CÓ nợ -> KHÔNG nợ (Hủy/Quay lại confirmed)
            ELSIF v_is_debt_status_old AND NOT v_is_debt_status_new THEN
                UPDATE public.customers_b2b
                SET current_debt = COALESCE(current_debt, 0) - OLD.final_amount
                WHERE id = NEW.customer_id;

            -- Case 3: Vẫn ở trạng thái CÓ nợ nhưng thay đổi số tiền hoặc đổi khách hàng
            ELSIF v_is_debt_status_old AND v_is_debt_status_new THEN
                -- Nếu đổi khách hàng
                IF OLD.customer_id != NEW.customer_id THEN
                    -- Trừ khách cũ
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - OLD.final_amount WHERE id = OLD.customer_id;
                    -- Cộng khách mới
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + NEW.final_amount WHERE id = NEW.customer_id;
                -- Nếu cùng khách nhưng đổi số tiền
                ELSIF OLD.final_amount != NEW.final_amount THEN
                    UPDATE public.customers_b2b
                    SET current_debt = COALESCE(current_debt, 0) + (NEW.final_amount - OLD.final_amount)
                    WHERE id = NEW.customer_id;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$function$;

-- 2. Gắn trigger cho cả INSERT và DELETE (Trước đây chỉ có UPDATE)
DROP TRIGGER IF EXISTS trg_update_debt_from_orders ON public.orders;
CREATE TRIGGER trg_update_debt_from_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION fn_trigger_update_debt_from_orders();

-- 3. Cập nhật trigger cho finance_transactions để handle NULL current_debt
CREATE OR REPLACE FUNCTION public.fn_trigger_update_customer_debt()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_diff numeric;
BEGIN
    -- [CASE 1]: INSERT
    IF (TG_OP = 'INSERT') AND NEW.status = 'completed' THEN
        IF NEW.partner_type = 'customer_b2b' AND NEW.partner_id IS NOT NULL THEN
            IF NEW.flow = 'in' THEN
                UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - NEW.amount WHERE id = NEW.partner_id::bigint;
            ELSIF NEW.flow = 'out' THEN
                UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + NEW.amount WHERE id = NEW.partner_id::bigint;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- [CASE 2]: UPDATE
    IF (TG_OP = 'UPDATE') THEN
        -- A. Nếu trạng thái chuyển sang 'completed' (Duyệt phiếu)
        IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
            IF NEW.partner_type = 'customer_b2b' AND NEW.partner_id IS NOT NULL THEN
                IF NEW.flow = 'in' THEN
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - NEW.amount WHERE id = NEW.partner_id::bigint;
                ELSIF NEW.flow = 'out' THEN
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + NEW.amount WHERE id = NEW.partner_id::bigint;
                END IF;
            END IF;
        -- B. Nếu hủy duyệt phiếu
        ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
            IF NEW.partner_type = 'customer_b2b' AND NEW.partner_id IS NOT NULL THEN
                IF NEW.flow = 'in' THEN
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + OLD.amount WHERE id = OLD.partner_id::bigint;
                ELSIF NEW.flow = 'out' THEN
                    UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - OLD.amount WHERE id = OLD.partner_id::bigint;
                END IF;
            END IF;
        -- C. Nếu đã 'completed' mà sửa số tiền
        ELSIF OLD.status = 'completed' AND NEW.status = 'completed' THEN
            IF NEW.partner_type = 'customer_b2b' AND NEW.partner_id IS NOT NULL THEN
                v_diff := NEW.amount - OLD.amount;
                IF v_diff != 0 THEN
                    IF NEW.flow = 'in' THEN
                        UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - v_diff WHERE id = NEW.partner_id::bigint;
                    ELSIF NEW.flow = 'out' THEN
                        UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + v_diff WHERE id = NEW.partner_id::bigint;
                    END IF;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- [CASE 3]: DELETE
    IF (TG_OP = 'DELETE') AND OLD.status = 'completed' THEN
        IF OLD.partner_type = 'customer_b2b' AND OLD.partner_id IS NOT NULL THEN
            IF OLD.flow = 'in' THEN
                -- Xóa phiếu thu -\u003e Trả lại nợ (Tăng nợ)
                UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) + OLD.amount WHERE id = OLD.partner_id::bigint;
            ELSIF OLD.flow = 'out' THEN
                -- Xóa phiếu chi -\u003e Giảm nợ
                UPDATE public.customers_b2b SET current_debt = COALESCE(current_debt, 0) - OLD.amount WHERE id = OLD.partner_id::bigint;
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$;

-- 4. BƯỚC QUAN TRỌNG: ĐỒNG BỘ LẠI DỮ LIỆU CỘT current_debt CHO TẤT CẢ KHÁCH HÀNG
-- Sử dụng logic từ dynamic VIEW để reset lại con số chuẩn
UPDATE public.customers_b2b c
SET current_debt = COALESCE(v.actual_current_debt, 0)
FROM public.b2b_customer_debt_view v
WHERE c.id = v.customer_id;

-- Riêng những khách hàng không có trong VIEW (chưa có đơn/phát sinh) thì set nợ = 0
UPDATE public.customers_b2b
SET current_debt = 0
WHERE id NOT IN (SELECT customer_id FROM public.b2b_customer_debt_view);

COMMIT;
