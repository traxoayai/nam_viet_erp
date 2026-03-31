// src/services/assetService.ts
import {
  AssetFormData,
  MaintenancePlan,
  MaintenanceHistory,
  AssetListRecord,
  AssetType,
} from "@/features/finance/types/asset";
import { uploadFile } from "@/shared/api/storageService";
import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

// Hàm hỗ trợ TẢI ẢNH TÀI SẢN
export const uploadAssetImage = async (file: File) => {
  return uploadFile(file, "asset_images"); // Tải lên bucket mới (Sếp cần tạo)
};

// --- 1. CỖ MÁY: LẤY DANH MỤC LOẠI TÀI SẢN ---
export const fetchAssetTypes = async (): Promise<AssetType[]> => {
  const { data, error } = await supabase
    .from("asset_types")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
};

// --- 2. CỖ MÁY: LẤY DANH SÁCH TÀI SẢN ---
export const fetchAssets = async (
  filters: any
): Promise<{ data: AssetListRecord[]; totalCount: number }> => {
  const { data } = await safeRpc("get_assets_list", {
    search_query: filters.search_query || null,
    type_filter: filters.asset_type_id || null,
    branch_filter: filters.branch_id || null,
    status_filter: filters.status || null, //-- BỎ PHÂN TRANG (Tạm thời cho list)
  });

  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: (data as AssetListRecord[]) || [], totalCount };
};

// --- 3. CỖ MÁY: LẤY CHI TIẾT TÀI SẢN ---
export const fetchAssetDetails = async (id: number): Promise<any> => {
  const { data } = await safeRpc("get_asset_details", { p_id: id });
  return data;
};

// --- 4. CỖ MÁY: TẠO MỚI TÀI SẢN ---
export const createAsset = async (
  assetData: AssetFormData,
  plans: MaintenancePlan[],
  history: MaintenanceHistory[]
) => {
  const { data } = await safeRpc("create_asset", {
    p_asset_data: assetData,
    p_maintenance_plans: plans,
    p_maintenance_history: history,
  });
  return data as number; // Trả về ID mới
};

// --- 5. CỖ MÁY: CẬP NHẬT TÀI SẢN ---
export const updateAsset = async (
  id: number,
  assetData: AssetFormData,
  plans: MaintenancePlan[],
  history: MaintenanceHistory[]
) => {
  await safeRpc("update_asset", {
    p_id: id,
    p_asset_data: assetData,
    p_maintenance_plans: plans,
    p_maintenance_history: history,
  });
  return true;
};

// --- 6. CỖ MÁY: XÓA TÀI SẢN ---
export const deleteAsset = async (id: number) => {
  await safeRpc("delete_asset", { p_id: id });
  return true;
};
