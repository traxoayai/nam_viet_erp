// src/types/asset.ts

// --- 1. ENUMs & Danh mục ---
export type AssetStatus = "active" | "storage" | "repair" | "disposed";
export type MaintenanceExecType = "internal" | "external";

export interface AssetType {
  id: number;
  name: string;
}

// --- 2. Cấu trúc Tài sản cho Table (Output của get_assets_list) ---
export interface AssetListRecord {
  key: string;
  id: number;
  asset_code: string;
  name: string;
  image_url: string | null;
  asset_type_name: string;
  branch_name: string;
  user_name: string;
  purchase_date: string;
  cost: number;
  depreciation_months: number;
  depreciation_per_month: number;
  remaining_value: number;
  status: AssetStatus;
}

// --- 3. Cấu trúc Form chi tiết (Dữ liệu con) ---
export interface MaintenancePlan {
  key?: string;
  content: string;
  frequency_months: number;
  exec_type: MaintenanceExecType;
  assigned_user_id?: string; // Dùng UUID cho User
  provider_name?: string;
  provider_phone?: string;
  provider_note?: string;
}

export interface MaintenanceHistory {
  key?: string;
  maintenance_date: string;
  content: string;
  cost: number;
}

// --- 4. Cấu trúc Form chi tiết (Input cho create_asset/update_asset) ---
export interface AssetFormData {
  name: string;
  description?: string;
  serial_number?: string;
  image_url?: string;
  asset_type_id: number;
  branch_id: number;
  user_id?: string; // Dùng UUID cho User
  status: AssetStatus;
  handed_over_date?: string;
  purchase_date: string;
  supplier_id?: number;
  cost: number;
  depreciation_months: number;
}

// --- 5. "Khuôn mẫu" cho Bộ não (Zustand Store) ---
export interface AssetStoreState {
  assets: AssetListRecord[];
  assetTypes: AssetType[];
  currentAssetDetails: {
    asset: AssetFormData & { id: number };
    maintenance_plans: MaintenancePlan[];
    maintenance_history: MaintenanceHistory[];
  } | null; // Trạng thái & Lọc

  loading: boolean;
  loadingDetails: boolean;
  filters: any;
  totalCount: number; // Danh mục chung

  fetchAssetTypes: () => Promise<void>; // Hành động CRUD
  fetchAssets: (filters: any) => Promise<void>;
  getAssetDetails: (id: number) => Promise<void>;
  createAsset: (
    assetData: AssetFormData,
    plans: MaintenancePlan[],
    history: MaintenanceHistory[]
  ) => Promise<number>;
  updateAsset: (
    id: number,
    assetData: AssetFormData,
    plans: MaintenancePlan[],
    history: MaintenanceHistory[]
  ) => Promise<boolean>;
  deleteAsset: (id: number) => Promise<boolean>;
}
