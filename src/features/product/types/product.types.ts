// src/features/product/types/product.types.ts
import { Warehouse } from "@/features/inventory/types/warehouse";

export interface Supplier {
  id: number;
  name: string;
}

export interface ProductUnit {
  id?: number;
  unit_name: string;
  conversion_rate: number;
  is_base: boolean;
  is_direct_sale: boolean;
  barcode?: string;
  // V2 Fields
  unit_type?: "base" | "retail" | "wholesale" | "logistics";
  price?: number;
}

export interface Product {
  key: string;
  id: number;
  name: string;
  sku: string;
  image_url: string;
  category_name: string;
  manufacturer_name: string;
  active_ingredient?: string; // [NEW]
  distributor_id?: number; // Thêm trường này để map với Form
  status: "active" | "inactive" | "deleted"; // Added 'deleted'

  // Tồn kho hiển thị
  inventory_b2b: number;
  inventory_pkdh: number;
  inventory_ntdh1: number;
  inventory_ntdh2: number;
  inventory_potec: number;

  // --- LOGISTICS (MỚI) ---
  items_per_carton?: number;
  carton_weight?: number;
  carton_dimensions?: string;
  purchasing_policy?: "ALLOW_LOOSE" | "FULL_CARTON_ONLY";

  // Giá & Đơn vị (Để hiển thị chi tiết)
  invoice_price?: number;
  actual_cost?: number;
  wholesale_unit?: string;
  retail_unit?: string;
  conversion_factor?: number;
  wholesale_margin_value?: number;
  wholesale_margin_type?: "percent" | "amount";
  retail_margin_value?: number;
  retail_margin_type?: "percent" | "amount";
  inventory_settings?: any;
  
  // Multi-unit V2
  units?: ProductUnit[];
}

export interface ProductFilters {
  search_query?: string;
  category_filter?: string;
  manufacturer_filter?: string;
  status_filter?: "active" | "inactive";
}

export interface ProductStoreState {
  // Dữ liệu
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[];

  // Dữ liệu danh mục & hãng
  uniqueCategories: string[];
  uniqueManufacturers: string[];

  // Trạng thái
  loading: boolean;
  loadingDetails: boolean;
  currentProduct: any | null;

  // Lọc & Phân trang
  filters: ProductFilters;
  page: number;
  pageSize: number;
  totalCount: number;

  // Hàm đọc
  fetchProducts: () => Promise<void>;
  fetchCommonData: () => Promise<void>;
  getProductDetails: (id: number) => Promise<void>;

  // Hàm ghi
  addProduct: (data: any) => Promise<void>;
  updateProduct: (id: number, data: any) => Promise<void>;
  updateStatus: (
    ids: React.Key[],
    status: "active" | "inactive"
  ) => Promise<void>;
  deleteProducts: (ids: React.Key[]) => Promise<void>;
  checkAndDeleteProducts: (ids: React.Key[]) => Promise<{ success: boolean; dependencies?: any[] }>;
  checkAndUpdateStatus: (ids: React.Key[], status: "active" | "inactive") => Promise<{ success: boolean; dependencies?: any[] }>; // [NEW]
  exportToExcel: () => Promise<any[]>;

  // Hàm tải danh mục
  fetchClassifications: () => Promise<void>;

  // Hàm nội bộ
  setFilters: (filters: Partial<ProductFilters>) => void;
  setPage: (page: number, pageSize: number) => void;
}
