// src/services/shippingPartnerService.ts
import { supabase } from "@/shared/lib/supabaseClient";
// import { uploadFile } from "@/services/storageService"; // Giả định service upload
import {
  ShippingPartnerListRecord,
  ShippingPartnerFormData,
  ShippingRule,
} from "@/features/partners/types/shippingPartner";

// --- BUCKET LƯU TRỮ (Nâng cấp sau) ---
// const PARTNER_FILES_BUCKET = "shipping_partner_files";

/**
 * 1. Tải danh sách Đối tác Vận chuyển (Không phân trang)
 */
export const fetchPartners = async (
  filters: any
): Promise<{ data: ShippingPartnerListRecord[]; totalCount: number }> => {
  const { data, error } = await supabase.rpc("get_shipping_partners_list", {
    p_search_query: filters.search_query || null,
    p_type_filter: filters.type_filter || null,
  });

  if (error) throw error;

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount: totalCount || 0 };
};

/**
 * 2. Tải chi tiết 1 Đối tác (Form Sửa)
 */
export const fetchPartnerDetails = async (id: number): Promise<any> => {
  const { data, error } = await supabase.rpc("get_shipping_partner_details", {
    p_id: id,
  });
  if (error) throw error;
  return data;
};

/**
 * 3. Tạo Đối tác mới
 */
export const createPartner = async (
  partnerData: ShippingPartnerFormData,
  rules: Omit<ShippingRule, "id">[]
): Promise<number | null> => {
  const { data, error } = await supabase.rpc("create_shipping_partner", {
    p_partner_data: partnerData,
    p_rules: rules,
  });
  if (error) throw error;
  return data as number;
};

/**
 * 4. Cập nhật Đối tác
 */
export const updatePartner = async (
  id: number,
  partnerData: ShippingPartnerFormData,
  rules: Omit<ShippingRule, "id">[]
): Promise<boolean> => {
  const { error } = await supabase.rpc("update_shipping_partner", {
    p_id: id,
    p_partner_data: partnerData,
    p_rules: rules,
  });
  if (error) throw error;
  return true;
};

/**
 * 5. Xóa (Ngừng Hợp tác)
 */
export const deletePartner = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("delete_shipping_partner", { p_id: id });
  if (error) throw error;
  return true;
};

/**
 * 6. Kích hoạt lại
 */
export const reactivatePartner = async (id: number): Promise<boolean> => {
  const { error } = await supabase.rpc("reactivate_shipping_partner", {
    p_id: id,
  });
  if (error) throw error;
  return true;
};
