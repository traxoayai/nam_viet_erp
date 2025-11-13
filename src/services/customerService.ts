// src/services/customerService.ts
import * as XLSX from "xlsx";

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
 * 5b. Khôi phục Khách hàng
 */
export const reactivateCustomer = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("reactivate_customer_b2c", { p_id: id });
  if (error) throw error;
  return true;
};

/**
 * 6. Nhập Excel (Bulk Upsert)
 */
/**
 * 6. Nhập Excel (Bulk Upsert)
 */
export const importCustomers = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName]; // SỬA LỖI: Dùng header: 1 để đọc file thô (raw)
      const jsonArray: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Dùng header là dòng 1
        raw: false, // Giữ định dạng (không convert ngày tháng)
        defval: null, // Ô trống là null
      });

      if (jsonArray.length < 2) {
        // Phải có ít nhất 1 header và 1 dòng data
        reject(new Error("File Excel rỗng hoặc không có dữ liệu."));
        return;
      } // Dòng đầu tiên là header

      const headers: string[] = jsonArray[0] as string[];
      const rawData = jsonArray.slice(1); // Tên cột header trong file Excel của Sếp
      const badTypeHeader = "type (CaNhan/ToChuc):"; // Tìm index của các cột
      const headerMap: { [key: string]: number } = {};
      headers.forEach((h, index) => {
        // Chuẩn hóa header (xóa khoảng trắng)
        const cleanHeader = String(h).trim();
        headerMap[cleanHeader] = index;
      }); // Map dữ liệu thô sang JSON "sạch"

      const cleanedArray = rawData.map((row) => {
        const customer: any = {}; // Lấy key chuẩn ('name', 'phone'...) và map với index
        //các cột BẮT BUỘC PHẢI có trong file Excel để nhập lên hệ thống - UNIQUE
        customer.customer_code = row[headerMap["customer_code"]];
        customer.name = row[headerMap["name"]];
        customer.phone = row[headerMap["phone"]];
        customer.loyalty_points = row[headerMap["loyalty_points"]]; // SỬA LỖI: Tìm key "xấu" (bad key)
        customer.type = row[headerMap[badTypeHeader]]; // (Thêm các cột khác Sếp cần import)
        // customer.email = row[headerMap['email']];
        // customer.tax_code = row[headerMap['tax_code']];

        // Các cột khác để THÊM THÔNG TIN nếu cần thiết
        customer.email = row[headerMap["email"]];
        customer.address = row[headerMap["address"]];
        customer.tax_code = row[headerMap["tax_code"]];
        customer.contact_person_name = row[headerMap["contact_person_name"]];
        customer.contact_person_phone = row[headerMap["contact_person_phone"]];
        return customer;
      }); // Gửi mảng JSON đã "sạch" đến RPC

      const { error: rpcError } = await supabase.rpc(
        "bulk_upsert_customers_b2c",
        {
          p_customers_array: cleanedArray,
        }
      );

      if (rpcError) throw rpcError;
      resolve(cleanedArray.length);
    } catch (error) {
      console.error("Lỗi Dịch vụ Import:", error);
      reject(error);
    }
  });
};

/**
 * 6b. Xuất Excel (Lấy tất cả)
 */
export const exportCustomers = async (
  filters: any
): Promise<CustomerListRecord[]> => {
  const { data, error } = await supabase.rpc("export_customers_b2c_list", {
    search_query: filters.search_query || null,
    type_filter: filters.type_filter || null,
    status_filter: filters.status_filter || null,
  });

  if (error) throw error;
  return data || [];
};

/**
 * 7. Tải ảnh (Avatar, CCCD)
 */
export const uploadAvatar = async (file: File) => {
  return uploadFile(file, AVATAR_BUCKET);
};
export const uploadIdentityCard = async (file: File) => {
  return uploadFile(file, CCCD_BUCKET);
};

/**
 * 8. CỖ MÁY: Tìm kiếm Người Giám hộ (cho Modal)
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
