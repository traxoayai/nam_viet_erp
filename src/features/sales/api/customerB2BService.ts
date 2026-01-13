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
  pageSize: number,
  sortByDebt: 'asc' | 'desc' | null = null // [NEW] Thêm tham số
): Promise<{ data: CustomerB2BListRecord[]; totalCount: number }> => {
  const { data, error } = await supabase.rpc("get_customers_b2b_list", {
    search_query: filters.search_query || null,
    sales_staff_filter: filters.sales_staff_filter || null,
    status_filter: filters.status_filter || null,
    page_num: page,
    page_size: pageSize,
    sort_by_debt: sortByDebt // [NEW] Truyền xuống RPC
  });

  if (error) throw error;

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount: Number(totalCount) };
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
    // 1. Tên Công ty (Bắt buộc)
    'Tên Công ty': 'name', 
    'Tên Nhà thuốc': 'name',
    'Tên Doanh nghiệp': 'name',
    'Họ và Tên': 'name', // Dự phòng nếu dùng mẫu cũ

    // 2. Mã Khách hàng
    'Mã Khách hàng': 'customer_code',
    'Mã KH': 'customer_code',

    // 3. Thông tin liên hệ chính
    'Số điện thoại': 'phone',
    'SĐT': 'phone',
    'Email': 'email',

    // 4. Thông tin Pháp lý & Địa chỉ (Đặc thù B2B)
    'Mã Số Thuế': 'tax_code', 
    'MST': 'tax_code',
    'Địa chỉ ĐKKD': 'vat_address',      // Địa chỉ xuất hóa đơn
    'Địa chỉ Xuất hóa đơn': 'vat_address',
    'Địa chỉ': 'vat_address',           // Fallback
    'Địa chỉ Giao hàng': 'shipping_address',
    'Địa chỉ Kho': 'shipping_address',

    // 5. Chính sách bán hàng (Đặc thù B2B)
    'Hạn mức nợ': 'debt_limit',
    'Hạn mức': 'debt_limit',
    'Kỳ hạn thanh toán': 'payment_term',
    'Số ngày nợ': 'payment_term',

    // 6. Thông tin Ngân hàng
    'Tên Ngân hàng': 'bank_name',
    'Số Tài khoản': 'bank_account_number',
    'Tên Chủ Tài khoản': 'bank_account_name',

    // 7. Nợ Đầu kỳ
    'Nợ Hiện Tại': 'initial_debt',
    'Công Nợ Đầu Kỳ': 'initial_debt',
    'Dư Nợ': 'initial_debt'
};

export const importCustomers = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Đọc file (Ô trống -> null)
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (rawData.length === 0) {
        reject(new Error("File Excel rỗng."));
        return;
      }

      const cleanedArray = rawData.map((row: any) => {
         const newRow: any = {
             // Khởi tạo giá trị mặc định để tránh undefined
             name: null,
             phone: null,
             initial_debt: 0
         };

         Object.keys(row).forEach((excelHeader) => {
            const cleanHeader = excelHeader.trim();
            // Map tiêu đề (Xử lý cả trường hợp viết hoa/thường nhẹ nhàng hơn nếu cần)
            const dbKey = B2B_COLUMN_MAP[cleanHeader] || B2B_COLUMN_MAP[cleanHeader.replace(/\s+/g, ' ')] || cleanHeader;
            
            let value = row[excelHeader];
            
            // Xử lý số liệu (Nợ, Hạn mức...)
            if (['initial_debt', 'debt_limit', 'payment_term'].includes(dbKey)) {
                if (typeof value === 'string') {
                    const cleanVal = value.replace(/\D/g, ''); 
                    value = cleanVal ? Number(cleanVal) : 0;
                } else if (typeof value !== 'number') {
                    value = 0;
                }
            }
            
            // Chỉ gán nếu map được key hợp lệ
            if (dbKey) {
                newRow[dbKey] = value;
            }
         });
         return newRow;
      });

      // [QUAN TRỌNG] BƯỚC LỌC DỮ LIỆU RÁC (FIX LỖI CỦA SẾP)
      // Chỉ lấy những dòng có Tên Công Ty
      const validArray = cleanedArray.filter((item: any) => item.name && String(item.name).trim() !== '');

      if (validArray.length === 0) {
          reject(new Error("Không tìm thấy dữ liệu hợp lệ. Vui lòng kiểm tra cột 'Tên Công ty'."));
          return;
      }

      console.log("Valid Data B2B to Upload:", validArray); // Log để kiểm tra

      const { error } = await supabase.rpc("bulk_upsert_customers_b2b", {
        p_customers_array: validArray,
      });

      if (error) throw error;
      resolve(validArray.length);
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
