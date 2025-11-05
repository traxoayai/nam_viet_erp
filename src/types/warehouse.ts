// src/types/warehouse.ts

export interface Warehouse {
  id: number;
  key: string;
  code: string;
  name: string;
  type: "b2b" | "retail";
  manager: string;
  phone: string;
  status: "active" | "inactive";
  address: string;
  latitude: number;
  longitude: number;
}

export interface WarehouseFilters {
  search_query?: string;
  type_filter?: "b2b" | "retail";
  status_filter?: "active" | "inactive";
}

// "Khuôn mẫu" cho Bộ não
export interface WarehouseStoreState {
  warehouses: Warehouse[];
  loading: boolean;
  filters: WarehouseFilters;
  page: number;
  pageSize: number;
  totalCount: number;

  fetchWarehouses: () => Promise<void>;
  setFilters: (filters: Partial<WarehouseFilters>) => void;
  setPage: (page: number, pageSize: number) => void;

  addWarehouse: (values: any) => Promise<boolean>;
  updateWarehouse: (id: number, values: any) => Promise<boolean>;
  deleteWarehouse: (id: number) => Promise<boolean>;
}
