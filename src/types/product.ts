// src/types/product.ts
import { Warehouse } from "@/types/warehouse";

export interface Supplier {
  id: number;
  name: string;
}

export interface Product {
  key: string;
  id: number;
  name: string;
  sku: string;
  image_url: string;
  category_name: string;
  manufacturer_name: string;
  distributor_id?: number; // Thêm trường này để map với Form
  status: "active" | "inactive";

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
  wholesale_margin_type?: "%" | "đ";
  retail_margin_value?: number;
  retail_margin_type?: "%" | "đ";
  inventory_settings?: any;
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
  exportToExcel: () => Promise<any[]>;

  // Hàm tải danh mục
  fetchClassifications: () => Promise<void>;

  // Hàm nội bộ
  setFilters: (filters: Partial<ProductFilters>) => void;
  setPage: (page: number, pageSize: number) => void;
}
