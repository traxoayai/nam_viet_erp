-- Migration: 20260121_upgrade_users_hr_status.sql
BEGIN;

    -- 1. Thêm cột Trạng thái làm việc (Quản trị)
    ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS work_state text DEFAULT 'working';

    -- 2. Thêm ràng buộc giá trị cho work_state
    ALTER TABLE public.users 
    ADD CONSTRAINT users_work_state_check 
    CHECK (work_state IN ('working', 'on_leave', 'resigned', 'test'));

    -- 3. Cập nhật dữ liệu cũ (Data Migration)
    -- Mặc định tất cả đang active -> working
    UPDATE public.users SET work_state = 'working' WHERE status = 'active';
    -- Mặc định inactive -> resigned (Sếp có thể sửa tay lại thành 'test' sau)
    UPDATE public.users SET work_state = 'resigned' WHERE status = 'inactive';
    
    -- 4. Xử lý riêng các User Test (Dựa vào tên/email) để đưa vào loại 'test'
    UPDATE public.users 
    SET work_state = 'test', status = 'inactive'
    WHERE full_name ILIKE '%Test%' OR email ILIKE '%test%';

    -- 5. Cập nhật View hoặc Index nếu cần (Optional)
    CREATE INDEX IF NOT EXISTS idx_users_work_state ON public.users(work_state);

COMMIT;