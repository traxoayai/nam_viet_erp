// src/types/supplier.ts
export interface Supplier {
  id: number;
  key: string;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  status: "active" | "inactive";
  debt: number;

  // Các trường chi tiết (từ Canvas của Sếp)
  address?: string;
  tax_code?: string;
  email?: string;
  payment_term?: string;
  bank_account?: string;
  bank_name?: string;
  bank_holder?: string;
  delivery_method?: string;
  lead_time?: number;
  notes?: string;
}

export interface SupplierFilters {
  search_query?: string;
  status_filter?: "active" | "inactive";
}

// "Khuôn mẫu" cho Bộ não
export interface SupplierStoreState {
  suppliers: Supplier[];
  currentSupplier: Supplier | null; // Dùng cho trang chi tiết
  loading: boolean;
  loadingDetails: boolean; // Dùng cho trang chi tiết

  filters: SupplierFilters;
  page: number;
  pageSize: number;
  totalCount: number;

  fetchSuppliers: () => Promise<void>;
  getSupplierDetails: (id: number) => Promise<void>;
  setFilters: (filters: Partial<SupplierFilters>) => void;
  setPage: (page: number, pageSize: number) => void;

  addSupplier: (values: Partial<Supplier>) => Promise<Supplier | null>;
  updateSupplier: (id: number, values: Partial<Supplier>) => Promise<boolean>;
  deleteSupplier: (id: number) => Promise<boolean>;
}
