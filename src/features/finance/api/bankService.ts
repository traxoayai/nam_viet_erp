// src/services/bankService.ts
import { Bank } from "@/features/finance/types/bank";
import { supabase } from "@/shared/lib/supabaseClient";

// API công khai của VietQR (từ file .pdf Sếp gửi)
const VIETQR_API_URL = "https://api.vietqr.io/v2/banks";

// 1. Tải danh sách ngân hàng TỪ CSDL CỦA SẾP
export const fetchBanks = async (): Promise<Bank[]> => {
  const { data, error } = await supabase
    .from("banks")
    .select("*")
    .order("short_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// 2. ĐỒNG BỘ từ VietQR (Nghiệp vụ "thần kỳ")
export const syncBanksFromVietQR = async (): Promise<number> => {
  // B1: Gọi API VietQR (public)
  const response = await fetch(VIETQR_API_URL);
  if (!response.ok) {
    throw new Error("Không thể kết nối đến máy chủ VietQR.");
  }
  const result = await response.json();
  const banksFromAPI: any[] = result.data; //[cite: 2400];

  if (!banksFromAPI || banksFromAPI.length === 0) {
    return 0;
  }

  // B2: Chuyển đổi dữ liệu từ API sang cấu trúc CSDL của Sếp
  const recordsToUpsert = banksFromAPI.map((bank) => ({
    name: bank.name,
    code: bank.code,
    bin: bank.bin,
    short_name: bank.shortName, // Chú ý: API là shortName [cite: 2405]
    logo: bank.logo,
    status: "active", // Mặc định là 'active'
    transfer_supported: !!bank.transferSupported, // [cite: 2411]
    lookup_supported: !!bank.lookupSupported, // [cite: 2412]
  }));

  // B3: Dùng 'upsert' để Thêm mới hoặc Cập nhật nếu đã tồn tại
  // (Dùng 'bin' làm khóa chính để tránh trùng lặp) [cite: 2404]
  const { error } = await supabase
    .from("banks")
    .upsert(recordsToUpsert, { onConflict: "bin" });

  if (error) throw error;
  return recordsToUpsert.length; // Trả về số lượng ngân hàng đã đồng bộ
};

// 3. Thêm ngân hàng (Thủ công)
export const addBank = async (
  values: Omit<Bank, "id" | "created_at" | "updated_at">
) => {
  const { error } = await supabase.from("banks").insert(values);
  if (error) throw error;
  return true;
};

// 4. Cập nhật ngân hàng (Thủ công)
export const updateBank = async (
  id: number,
  values: Omit<Bank, "id" | "created_at" | "updated_at">
) => {
  const { error } = await supabase.from("banks").update(values).eq("id", id);
  if (error) throw error;
  return true;
};

// 5. Xóa ngân hàng
export const deleteBank = async (id: number) => {
  const { error } = await supabase.from("banks").delete().eq("id", id);
  if (error) throw error;
  return true;
};
