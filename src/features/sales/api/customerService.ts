// src/services/customerService.ts
import * as XLSX from "xlsx";

import { CustomerListRecord } from "@/features/sales/types/customer";
import { uploadFile } from "@/shared/api/storageService";
import { supabase } from "@/shared/lib/supabaseClient";

// --- BUCKET LƯU TRỮ CHO KHÁCH HÀNG ---
const AVATAR_BUCKET = "customer_avatars";
const CCCD_BUCKET = "customer_identity";

// --- CÁC "CỖ MÁY" API GỌI RPC ---

/**
 * 1. Tải danh sách Khách hàng B2C (Phân trang & Tìm kiếm 2 chiều)
 */
export const fetchCustomers = async (
  filters: any,
  page: number,
  pageSize: number,
  sortByDebt: "asc" | "desc" | null = null // [NEW] Thêm tham số
): Promise<{ data: CustomerListRecord[]; totalCount: number }> => {
  const { data, error } = await supabase.rpc("get_customers_b2c_list", {
    search_query: filters.search_query || null,
    type_filter: filters.type_filter || null,
    status_filter: filters.status_filter || null,
    page_num: page,
    page_size: pageSize,
    sort_by_debt: sortByDebt, // [NEW] Truyền xuống RPC
  });

  if (error) throw error;

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount: Number(totalCount) };
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
// Định nghĩa MAPPER: Key là Tiếng Việt (trong Excel), Value là Key chuẩn DB
// 1. MAPPER: CHỈ ĐỊNH CÁC CỘT QUAN TRỌNG
const B2C_COLUMN_MAP: Record<string, string> = {
  // --- 4 CỘT BẮT BUỘC (MANDATORY) ---
  "Loại khách": "type",
  "Loại KH": "type",
  "Mã Khách hàng": "customer_code",
  "Mã KH": "customer_code",
  "Họ và Tên": "name",
  Tên: "name",
  "Số điện thoại": "phone",
  SĐT: "phone",
  SDT: "phone",

  // --- CÁC CỘT TÙY CHỌN (OPTIONAL) ---
  "Điểm tích lũy": "loyalty_points",
  "Địa chỉ": "address",
  Email: "email",
  "Ngày sinh": "dob",
  "Giới tính": "gender",
  "Mã số thuế": "tax_code",
  MST: "tax_code",
  "Người liên hệ": "contact_person_name",
  "SĐT Người LH": "contact_person_phone",
  "Nợ hiện tại": "initial_debt",
  "Nợ cũ": "initial_debt",
};

export const importCustomers = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Đọc file Excel (Ô trống -> null)
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
      });

      if (rawData.length === 0) {
        reject(new Error("File Excel rỗng."));
        return;
      }

      const cleanedArray = rawData.map((row) => {
        // A. KHỞI TẠO OBJECT CHUẨN VỚI GIÁ TRỊ NULL (Reset toàn bộ)
        // Đảm bảo dù Excel thiếu cột thì DB vẫn nhận được null
        const newRow: any = {
          type: null,
          customer_code: null,
          name: null,
          phone: null,
          email: null,
          address: null,
          dob: null,
          gender: null,
          loyalty_points: 0, // Số thì default 0
          initial_debt: 0, // Số thì default 0
          tax_code: null,
          contact_person_name: null,
          contact_person_phone: null,
        };

        // B. MAPPING DỮ LIỆU TỪ EXCEL VÀO
        Object.keys(row).forEach((excelHeader) => {
          const cleanHeader = excelHeader.trim();
          const dbKey = B2C_COLUMN_MAP[cleanHeader];

          // Chỉ xử lý nếu cột đó nằm trong danh sách Mapper
          if (dbKey) {
            let value = row[excelHeader];

            // 1. Xử lý Số liệu (Xóa dấu phẩy)
            if (["initial_debt", "loyalty_points"].includes(dbKey)) {
              if (typeof value === "string") {
                const cleanNumber = value.replace(/\D/g, "");
                // Nếu chuỗi rỗng sau khi clean -> coi là 0
                value = cleanNumber ? Number(cleanNumber) : 0;
              } else if (typeof value === "number") {
                value = value;
              } else {
                value = 0; // null/undefined -> 0
              }

              // Ép gán luôn (không cần check null ở dưới nữa)
              newRow[dbKey] = value;
              return; // Continue to next key
            }

            // 2. Xử lý Giới tính (Map sang ENUM chuẩn)
            if (dbKey === "gender" && value) {
              const g = String(value).toLowerCase().trim();
              if (["nam", "male", "trai", "ông"].includes(g)) value = "male";
              else if (["nữ", "nu", "female", "gái", "bà"].includes(g))
                value = "female";
              else value = null; // Không khớp thì null
            }

            // 3. Xử lý Ngày sinh (Rỗng/Khoảng trắng -> NULL)
            if (dbKey === "dob") {
              if (!value || String(value).trim() === "") value = null;
            }

            // Gán giá trị (Nếu khác null/undefined mới gán đè)
            if (value !== null && value !== undefined) {
              newRow[dbKey] = value;
            }
          }
        });

        // C. KIỂM TRA BẮT BUỘC (FALLBACK)
        // Nếu file thiếu cột "Loại khách", mặc định là CaNhan cho an toàn
        if (!newRow.type) newRow.type = "CaNhan";

        // Nếu thiếu Mã KH, để null (DB sẽ tự sinh mã KH-xxxxx)
        if (
          !newRow.customer_code ||
          String(newRow.customer_code).trim() === ""
        ) {
          newRow.customer_code = null;
        }

        return newRow;
      });

      // Lọc bỏ các dòng rác (không có Tên và SĐT)
      const validArray = cleanedArray.filter((item) => item.name && item.phone);

      if (validArray.length === 0) {
        reject(
          new Error(
            "Không tìm thấy dữ liệu hợp lệ. Vui lòng kiểm tra cột 'Họ và Tên' và 'Số điện thoại'."
          )
        );
        return;
      }

      // // --- [CHÈN LOG VÀO ĐÂY] ---
      // console.log("=== DEBUG IMPORT DATA ===");
      // console.log("Toàn bộ dữ liệu gửi đi:", validArray);
      // console.log("Dòng CaNhan:", validArray.find((x: any) => x.type === 'CaNhan'));
      // console.log("Dòng ToChuc:", validArray.find((x: any) => x.type === 'ToChuc'));
      // // --------------------------

      console.log("Data Sent to DB:", validArray);

      const { error: rpcError } = await supabase.rpc(
        "bulk_upsert_customers_b2c",
        {
          p_customers_array: validArray,
        }
      );

      if (rpcError) throw rpcError;
      resolve(validArray.length);
    } catch (error) {
      console.error("Import Error:", error);
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
