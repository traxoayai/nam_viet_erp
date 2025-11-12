// src/services/customerService.ts
import { supabase } from "@/lib/supabaseClient";
import { uploadFile } from "@/services/storageService";
import { CustomerListRecord } from "@/types/customer";

// --- BUCKET LƯU TRỮ CHO KHÁCH HÀNG ---
const AVATAR_BUCKET = "customer_avatars";
const CCCD_BUCKET = "customer_identity";

// --- CÁC "CỖ MÁY" API GỌI RPC ---

/**
 * 1. Tải danh sách Khách hàng B2C (Phân trang & Tìm kiếm 2 chiều)
 */
export const fetchCustomers = async (
  filters: any
): Promise<{ data: CustomerListRecord[]; totalCount: number }> => {
  const { data, error } = await supabase.rpc("get_customers_b2c_list", {
    search_query: filters.search_query || null,
    type_filter: filters.type_filter || null,
    status_filter: filters.status_filter || null, // Sếp lưu ý: Hàm RPC này của chúng ta chưa hỗ trợ Phân trang (page_num, page_size)
    // Em sẽ thêm logic này vào RPC sau nếu Sếp yêu cầu.
  });

  if (error) throw error;

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount: totalCount || 0 };
};

/**
 * 2. Tải chi tiết 1 Khách hàng (Form Sửa)
 */
export const fetchCustomerDetails = async (id: number): Promise<any> => {
  const { data, error } = await supabase.rpc("get_customer_b2c_details", {
    p_id: id,
  });
  if (error) throw error;
  return data;
};

/**
 * 3. Tạo Khách hàng mới
 */
export const createCustomer = async (
  customerData: any,
  guardians: any[]
): Promise<number | null> => {
  const { data, error } = await supabase.rpc("create_customer_b2c", {
    p_customer_data: customerData,
    p_guardians: guardians,
  });
  if (error) throw error;
  return data as number;
};

/**
 * 4. Cập nhật Khách hàng
 */
export const updateCustomer = async (
  id: number,
  customerData: any,
  guardians: any[]
): Promise<boolean> => {
  const { error } = await supabase.rpc("update_customer_b2c", {
    p_id: id,
    p_customer_data: customerData,
    p_guardians: guardians,
  });
  if (error) throw error;
  return true;
};

/**
 * 5. Xóa Khách hàng (Xóa mềm)
 */
export const deleteCustomer = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("delete_customer_b2c", { p_id: id });
  if (error) throw error;
  return true;
};

/**
 * 6. Tải ảnh (Avatar, CCCD)
 */
export const uploadAvatar = async (file: File) => {
  return uploadFile(file, AVATAR_BUCKET);
};
export const uploadIdentityCard = async (file: File) => {
  return uploadFile(file, CCCD_BUCKET);
};

/**
 * 7. CỖ MÁY: Tìm kiếm Người Giám hộ (cho Modal)
 */
export const searchGuardians = async (
  query: string
): Promise<CustomerListRecord[]> => {
  if (!query || query.length < 3) return []; // Chỉ tìm khi có ít nhất 3 ký tự
  const { data, error } = await supabase.rpc("search_customers_by_phone_b2c", {
    p_search_query: query,
  });
  if (error) throw error;
  return data || [];
};
