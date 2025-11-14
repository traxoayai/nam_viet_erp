// src/types/customerB2B.ts

// Import ENUM chung từ file B2C (vì nó là public.account_status)
import { CustomerStatus } from "@/types/customer";

// 1. Bảng con: Người liên hệ (từ customer_b2b_contacts)
export interface CustomerB2BContact {
  id?: number;
  customer_b2b_id?: number;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  key?: string; // Key tạm thời cho Form.List AntD
}

// 2. Bảng chính: Khách hàng B2B (từ customers_b2b)
export interface CustomerB2B {
  id: number;
  customer_code: string | null;
  name: string;
  tax_code: string | null;
  debt_limit: number | null;
  payment_term: number | null;
  ranking: string | null;
  business_license_number: string | null;
  business_license_url: string | null;
  sales_staff_id: string | null; // UUID
  status: CustomerStatus;
  phone: string | null;
  email: string | null;
  vat_address: string | null;
  shipping_address: string | null;
  gps_lat: number | null;
  gps_long: number | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  current_debt?: number;
}

// 3. Bảng Danh sách (Output của RPC get_customers_b2b_list)
export interface CustomerB2BListRecord {
  key: string;
  id: number;
  customer_code: string | null;
  name: string;
  phone: string | null;
  sales_staff_name: string | null;
  debt_limit: number | null;
  current_debt: number; // Tạm thời
  status: CustomerStatus;
}

// 4. Lịch sử GD (Tạm thời, sẽ nâng cấp)
export interface TransactionHistory {
  key: number;
  date: string;
  code: string;
  content: string;
  total: number;
}

// 5. Chi tiết (Output của RPC get_customer_b2b_details)
export interface CustomerB2BDetailsData {
  customer: CustomerB2B;
  contacts: CustomerB2BContact[] | null;
  history: TransactionHistory[] | null;
}

// 6. Dữ liệu Form (Input cho RPC create/update)
export interface CustomerB2BFormData {
  name: string;
  tax_code?: string;
  debt_limit?: number;
  payment_term?: number;
  ranking?: string;
  business_license_number?: string;
  sales_staff_id?: string; // UUID
  business_license_url?: string | null;
  status: CustomerStatus;
  phone?: string;
  email?: string;
  vat_address?: string;
  shipping_address?: string;
  gps_lat?: number;
  gps_long?: number;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
}

// 7. Khuôn mẫu "Bộ não" (Store)
export interface CustomerB2BStoreState {
  customers: CustomerB2BListRecord[];
  loading: boolean;
  loadingDetails: boolean;
  isFormView: boolean;
  editingCustomer: CustomerB2BDetailsData | null;
  totalCount: number;
  page: number;
  pageSize: number;
  filters: any; // Hàm

  fetchCustomers: (filters: any) => Promise<void>;
  getCustomerDetails: (id: number) => Promise<void>;
  createCustomer: (data: any, contacts: any[]) => Promise<number | null>;
  updateCustomer: (id: number, data: any, contacts: any[]) => Promise<boolean>;
  deleteCustomer: (id: number) => Promise<boolean>;
  reactivateCustomer: (id: number) => Promise<boolean>; // Chuyển trạng thái khách hàng thành Đang Giao Dịch
  exportToExcel: () => Promise<any[]>; // Xuất Excel
  importCustomers: (file: File) => Promise<number>; // Nhập Excel
  setPage: (page: number, pageSize: number) => void;
  showListView: () => void;
  showFormView: (record?: CustomerB2BListRecord) => void;
}
