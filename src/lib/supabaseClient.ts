// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Lấy thông tin kết nối từ "két sắt" .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Kiểm tra để đảm bảo chúng ta không vô tình làm lộ key
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL hoặc Anon Key chưa được thiết lập trong file .env"
  );
}

// Tạo và export một client duy nhất để dùng trong toàn bộ ứng dụng
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
