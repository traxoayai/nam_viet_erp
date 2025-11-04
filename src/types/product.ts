// src/types/product.ts

// Định nghĩa các kiểu dữ liệu dùng chung
export interface Category {
  id: number;
  name: string;
}

export interface Manufacturer {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  key: string;
  name: string;
  unit: string;
}

// Định nghĩa kiểu dữ liệu cho sản phẩm,
// khớp với "cỗ máy" API Sếp đã tạo trong SQL
export interface Product {
  key: string;
  id: number;
  name: string;
  sku: string;
  image_url: string;
  category: Category;
  manufacturer: Manufacturer;
  status: "active" | "inactive";
  inventory_b2b: number;
  inventory_pkdh: number;
  inventory_ntdh1: number;
  inventory_ntdh2: number;
  inventory_potec: number;
}

// Định nghĩa kiểu cho các bộ lọc
export interface ProductFilters {
  search_query?: string;
  category_filter?: number;
  manufacturer_filter?: number;
  status_filter?: "active" | "inactive";
}

// Định nghĩa kiểu cho "kho" Zustand
export interface ProductStoreState {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  warehouses: Warehouse[];
  loading: boolean;
  filters: ProductFilters;
  page: number;
  pageSize: number;
  totalCount: number;

  // Hành động
  fetchProducts: () => Promise<void>;
  fetchFiltersData: () => Promise<void>;
  setFilters: (filters: Partial<ProductFilters>) => void;
  setPage: (page: number, pageSize: number) => void;
}
