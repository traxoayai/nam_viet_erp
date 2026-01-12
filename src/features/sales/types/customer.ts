// src/features/sales/types/customer.ts

// --- 1. ENUMs & Types (Khớp với CSDL) ---
export type CustomerB2CType = "CaNhan" | "ToChuc";
export type CustomerGender = "Nam" | "Nữ" | "Khác";
export type CustomerStatus = "active" | "inactive";

// --- 2. Cấu trúc cho Bảng Giám hộ (Dùng trong Form) ---
export interface CustomerGuardian {
  id?: number; // ID của dòng liên kết (từ bảng customer_guardians)
  guardian_id: number; // ID của khách hàng (Bố/Mẹ)
  relationship: string;
  name?: string; // Tên của Bố/Mẹ (để hiển thị)
  phone?: string; // SĐT của Bố/Mẹ (để hiển thị)
  key?: string; // Key tạm thời cho Form.List
}

// --- 3. Cấu trúc cho Lịch sử Giao dịch (Tạm thời) ---
export interface CustomerHistory {
  key: number;
  date: string;
  content: string;
  cost: number;
}

// --- 4. Cấu trúc Khách hàng (Bảng `customers`) ---
export interface CustomerB2C {
  id: number;
  customer_code: string;
  name: string;
  type: CustomerB2CType;
  phone: string | null;
  email: string | null;
  address: string | null;
  dob: string | null; // (YYYY-MM-DD)
  gender: CustomerGender | null;
  cccd: string | null;
  cccd_issue_date: string | null;
  avatar_url: string | null;
  cccd_front_url: string | null;
  cccd_back_url: string | null;
  occupation: string | null;
  lifestyle_habits: string | null;
  allergies: string | null;
  medical_history: string | null;
  tax_code: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  loyalty_points: number;
  status: CustomerStatus;
}

// --- 5. Cấu trúc cho Bảng (Output của RPC `get_customers_b2c_list`) ---
export interface CustomerListRecord {
  key: string;
  id: number;
  customer_code: string;
  name: string;
  type: CustomerB2CType;
  phone: string | null;
  loyalty_points: number;
  status: CustomerStatus;
  current_debt: number; // [NEW] Số tiền nợ
  total_count: number;
}

// --- 6. Cấu trúc Chi tiết (Output của RPC `get_customer_b2c_details`) ---
export interface CustomerDetailsData {
  customer: CustomerB2C;
  guardians: CustomerGuardian[] | null;
  history: CustomerHistory[] | null;
}

export interface CustomerFormData {
  name: string;
  type: CustomerB2CType;
  phone: string | null;
  email: string | null;
  address: string | null;
  dob: string | null;
  gender: CustomerGender | null;
  cccd: string | null;
  cccd_issue_date: string | null;
  avatar_url: string | null;
  cccd_front_url: string | null;
  cccd_back_url: string | null;
  occupation: string | null;
  lifestyle_habits: string | null;
  allergies: string | null;
  medical_history: string | null;
  tax_code: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  loyalty_points: number;
  status: CustomerStatus;
}

// --- 7. "Khuôn mẫu" cho Bộ não (Zustand Store) ---
export interface CustomerB2CStoreState {
  customers: CustomerListRecord[];
  loading: boolean;
  loadingDetails: boolean;
  isModalVisible: boolean; // Dùng cho Modal Thêm/Sửa
  isFormView: boolean; // Trạng thái xem (Danh sách / Form)
  editingCustomer: CustomerDetailsData | null;
  editingCustomerType: CustomerB2CType; // 'CaNhan' hoặc 'ToChuc'
  totalCount: number; // --- Hàm hành động ---
  filters: any;
  page: number; // <-- Phân trang
  pageSize: number; // <-- Số nội dung hiển thị / trang
  sortDebt: 'asc' | 'desc' | null; // [NEW]

  fetchCustomers: (filters: any, sortDebt?: 'asc' | 'desc' | null) => Promise<void>;
  getCustomerDetails: (id: number) => Promise<void>;
  createCustomer: (data: any, guardians: any) => Promise<number | null>;
  updateCustomer: (id: number, data: any, guardians: any) => Promise<boolean>;
  deleteCustomer: (id: number) => Promise<boolean>; // --- Quản lý UI ---
  reactivateCustomer: (id: number) => Promise<boolean>;
  exportToExcel: () => Promise<CustomerListRecord[]>;
  importCustomers: (file: File) => Promise<number>;
  setPage: (page: number, pageSize: number) => void; // Phân trang
  showListView: () => void;
  showFormView: (type: CustomerB2CType, record?: CustomerListRecord) => void;
  closeModal: () => void; // (Dùng cho Modal Thêm Giám hộ)
  // --- Tìm kiếm Giám hộ (cho Modal) ---

  searchGuardians: (phone: string) => Promise<CustomerListRecord[]>;
}
