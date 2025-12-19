// src/services/customerB2BService.ts
// import { format } from "path";

import * as XLSX from "xlsx";

import { supabase } from "@/shared/lib/supabaseClient";
import { uploadFile } from "@/shared/api/storageService";
import {
  CustomerB2BListRecord,
  CustomerB2BFormData,
  CustomerB2BContact,
} from "@/features/sales/types/customerB2B";

// --- BUCKET LƯU TRỮ CHO KHÁCH HÀNG B2B ---
const B2B_LOGO_BUCKET = "customer_b2b_logos";
const B2B_LICENSE_BUCKET = "customer_b2b_licenses";

/**
 * 1. Tải danh sách Khách hàng B2B (Đã phân trang)
 */
export const fetchCustomers = async (
  filters: any,
  page: number,
  pageSize: number
): Promise<{ data: CustomerB2BListRecord[]; totalCount: number }> => {
  const { data, error } = await supabase.rpc("get_customers_b2b_list", {
    search_query: filters.search_query || null,
    sales_staff_filter: filters.sales_staff_filter || null,
    status_filter: filters.status_filter || null,
    page_num: page,
    page_size: pageSize,
  });

  if (error) throw error;

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount: totalCount || 0 };
};

/**
 * 2. Tải chi tiết 1 Khách hàng B2B (Form Sửa)
 */
export const fetchCustomerDetails = async (id: number): Promise<any> => {
  const { data, error } = await supabase.rpc("get_customer_b2b_details", {
    p_id: id,
  });
  if (error) throw error;
  return data;
};

/**
 * 3. Tạo Khách hàng B2B mới
 */
export const createCustomer = async (
  customerData: Partial<CustomerB2BFormData>,
  contacts: Omit<CustomerB2BContact, "id">[]
): Promise<number | null> => {
  const { data, error } = await supabase.rpc("create_customer_b2b", {
    p_customer_data: customerData,
    p_contacts: contacts,
  });
  if (error) throw error;
  return data as number;
};

/**
 * 4. Cập nhật Khách hàng B2B
 */
export const updateCustomer = async (
  id: number,
  customerData: Partial<CustomerB2BFormData>,
  contacts: Omit<CustomerB2BContact, "id">[]
): Promise<boolean> => {
  const { error } = await supabase.rpc("update_customer_b2b", {
    p_id: id,
    p_customer_data: customerData,
    p_contacts: contacts,
  });
  if (error) throw error;
  return true;
};

/**
 * 5. Xóa Khách hàng B2B (Xóa mềm)
 */
export const deleteCustomer = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("delete_customer_b2b", { p_id: id });
  if (error) throw error;
  return true;
};

/**
 * 6. Kích hoạt Khách hàng B2B
 */
export const reactivateCustomer = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("reactivate_customer_b2b", { p_id: id });
  if (error) throw error;
  return true;
};

/**
 * 7. Nhập Excel (Bulk Upsert)
 */
export const importCustomers = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName]; // Chuyển đổi thành JSON (dòng đầu tiên là header)
      // 'defval: null' đảm bảo ô trống là NULL (quan trọng)
      const jsonArray: any[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
      });

      if (jsonArray.length === 0) {
        reject(new Error("File Excel rỗng hoặc sai định dạng."));
        return;
      } // (Không cần dọn dẹp key nếu Sếp dùng tên cột chuẩn)

      const { error: rpcError } = await supabase.rpc(
        "bulk_upsert_customers_b2b",
        {
          p_customers_array: jsonArray,
        }
      );

      if (rpcError) throw rpcError;
      resolve(jsonArray.length);
    } catch (error) {
      console.error("Lỗi Dịch vụ Import B2B:", error);
      reject(error);
    }
  });
};

/**
 * 8. Xuất Excel (Lấy tất cả)
 */
export const exportCustomers = async (filters: any): Promise<any[]> => {
  const { data, error } = await supabase.rpc("export_customers_b2b_list", {
    search_query: filters.search_query || null,
    sales_staff_filter: filters.sales_staff_filter || null,
    status_filter: filters.status_filter || null,
  });

  if (error) throw error;
  return data || [];
};

/**
 * 9. Tải ảnh (Logo, GPKD)
 */
export const uploadLogo = async (file: File) => {
  return uploadFile(file, B2B_LOGO_BUCKET);
};
export const uploadLicense = async (file: File) => {
  return uploadFile(file, B2B_LICENSE_BUCKET);
};
