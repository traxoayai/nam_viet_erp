// src/types/product.ts
import { Warehouse } from "@/types/warehouse";

// export interface Warehouse {
//   id: number;
//   key: string;
//   name: string;
//   unit: string;
//   warehouse_type?: "b2b" | "retail";
//   address?: string | null;
//   location_gps?: string | null;
// }

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
  category_name: string; // Đã đổi
  manufacturer_name: string; // Đã đổi
  status: "active" | "inactive";
  inventory_b2b: number;
  inventory_pkdh: number;
  inventory_ntdh1: number;
  inventory_ntdh2: number;
  inventory_potec: number;
}

export interface ProductFilters {
  search_query?: string;
  category_filter?: string; // Đã đổi
  manufacturer_filter?: string; // Đã đổi
  status_filter?: "active" | "inactive";
}

export interface ProductStoreState {
  // Dữ liệu
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[]; // Thêm Nhà Cung Cấp

  // --- THÊM MỚI: Dữ liệu danh mục & hãng ---
  uniqueCategories: string[];
  uniqueManufacturers: string[];
  // ---------------------------------------

  // Trạng thái
  loading: boolean;
  loadingDetails: boolean;
  currentProduct: any | null;

  // Lọc & Phân trang
  filters: ProductFilters;
  page: number;
  pageSize: number;
  totalCount: number;

  //Hàm đọc
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

  // --- THÊM MỚI: Hàm tải danh mục ---
  fetchClassifications: () => Promise<void>;
  // Hàm nội bộ
  setFilters: (filters: Partial<ProductFilters>) => void;
  setPage: (page: number, pageSize: number) => void;
}
