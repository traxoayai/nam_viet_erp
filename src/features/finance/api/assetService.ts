// src/services/assetService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import { uploadFile } from "@/shared/api/storageService";
import {
  AssetFormData,
  MaintenancePlan,
  MaintenanceHistory,
  AssetListRecord,
  AssetType,
} from "@/features/finance/types/asset";

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
  const { data, error } = await supabase.rpc("get_assets_list", {
    search_query: filters.search_query || null,
    type_filter: filters.asset_type_id || null,
    branch_filter: filters.branch_id || null,
    status_filter: filters.status || null, //-- BỎ PHÂN TRANG (Tạm thời cho list)
  });

  if (error) throw error; // -- Hàm RPC của Sếp đã có total_count
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: (data as AssetListRecord[]) || [], totalCount };
};

// --- 3. CỖ MÁY: LẤY CHI TIẾT TÀI SẢN ---
export const fetchAssetDetails = async (id: number): Promise<any> => {
  const { data, error } = await supabase.rpc("get_asset_details", { p_id: id });
  if (error) throw error;
  return data;
};

// --- 4. CỖ MÁY: TẠO MỚI TÀI SẢN ---
export const createAsset = async (
  assetData: AssetFormData,
  plans: MaintenancePlan[],
  history: MaintenanceHistory[]
) => {
  const { data, error } = await supabase.rpc("create_asset", {
    p_asset_data: assetData,
    p_maintenance_plans: plans,
    p_maintenance_history: history,
  });
  if (error) throw error;
  return data as number; // Trả về ID mới
};

// --- 5. CỖ MÁY: CẬP NHẬT TÀI SẢN ---
export const updateAsset = async (
  id: number,
  assetData: AssetFormData,
  plans: MaintenancePlan[],
  history: MaintenanceHistory[]
) => {
  const { error } = await supabase.rpc("update_asset", {
    p_id: id,
    p_asset_data: assetData,
    p_maintenance_plans: plans,
    p_maintenance_history: history,
  });
  if (error) throw error;
  return true;
};

// --- 6. CỖ MÁY: XÓA TÀI SẢN ---
export const deleteAsset = async (id: number) => {
  const { error } = await supabase.rpc("delete_asset", { p_id: id });
  if (error) throw error;
  return true;
};
