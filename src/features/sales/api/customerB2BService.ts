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
// MAPPER B2B
// SỬA FILE: src/services/customerService.ts

const B2B_COLUMN_MAP: Record<string, string> = {
    // 1. Mã Khách Hàng (Chấp nhận nhiều cách gọi)
    'Mã Khách hàng': 'customer_code',
    'Mã KH': 'customer_code',
    'Mã khách': 'customer_code',

    // 2. Họ tên
    'Họ và Tên': 'name',
    'Tên Khách Hàng': 'name',
    'Tên': 'name',

    // 3. Số điện thoại
    'Số điện thoại': 'phone',
    'SĐT': 'phone',
    'SDT': 'phone',

    // 4. Loại Khách Hàng (QUAN TRỌNG)
    'Loại khách': 'type',
    'Loại KH': 'type',
    'Loại hình': 'type',        // CaNhan hoặc ToChuc
    'Đối tượng': 'type',

    // 5. Các thông tin khác
    'Điểm tích lũy': 'loyalty_points',
    'Điểm': 'loyalty_points',
    'Địa chỉ': 'address',
    'Email': 'email',
    'Ngày sinh': 'dob',
    'Giới tính': 'gender',
    'Số CCCD': 'cccd',
    'CMND': 'cccd',

    // 6. Thông tin Tổ chức (Nếu là Doanh nghiệp lẻ)
    'Mã số thuế': 'tax_code',
    'MST': 'tax_code',
    'Người liên hệ': 'contact_person_name',
    'SĐT Liên hệ': 'contact_person_phone',

    // 7. Nợ cũ
    'Nợ Hiện Tại': 'initial_debt',
    'Dư Nợ': 'initial_debt',
    'Công Nợ Đầu Kỳ': 'initial_debt'
};

export const importCustomers = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (rawData.length === 0) { reject(new Error("File Rỗng")); return; }

      const cleanedArray = rawData.map((row) => {
         const newRow: any = {};
         Object.keys(row).forEach((excelHeader) => {
            const cleanHeader = excelHeader.trim();
            const dbKey = B2B_COLUMN_MAP[cleanHeader] || cleanHeader;
            
            let value = row[excelHeader];
            // Format số
            if (['initial_debt', 'debt_limit', 'payment_term'].includes(dbKey) && typeof value === 'string') {
                value = parseFloat(value.replace(/,/g, ''));
            }
            newRow[dbKey] = value;
         });
         return newRow;
      });

      const { error } = await supabase.rpc("bulk_upsert_customers_b2b", {
        p_customers_array: cleanedArray,
      });

      if (error) throw error;
      resolve(cleanedArray.length);
    } catch (error) {
      console.error("Import B2B Error:", error);
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
