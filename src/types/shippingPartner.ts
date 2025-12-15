// src/types/shippingPartner.ts

// Import ENUM chung (active/inactive)
import { CustomerStatus } from "@/types/customer";

// --- 1. ENUMs & Types (Khớp với CSDL) ---
export type ShippingPartnerType = "app" | "coach" | "internal";
export type ShippingPartnerStatus = CustomerStatus; // Tái sử dụng 'active' | 'inactive'

// --- 2. Bảng con: Quy tắc Vùng (từ shipping_rules) ---
export interface ShippingRule {
  id?: number;
  partner_id?: number;
  zone_name: string;
  speed_hours: number | null;
  fee: number | null;
  key?: string; // Key tạm thời cho Form.List AntD
}

// --- 3. Bảng chính: Đối tác Vận chuyển (từ shipping_partners) ---
export interface ShippingPartner {
  id: number;
  name: string;
  type: ShippingPartnerType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ShippingPartnerStatus;
  cut_off_time: string | null; // (HH:mm)
  created_at?: string;
  updated_at?: string;
  speed_hours: number;
  base_fee: number;
}

// --- 4. Bảng Danh sách (Output của RPC get_shipping_partners_list) ---
export interface ShippingPartnerListRecord {
  key: string;
  id: number;
  name: string;
  type: ShippingPartnerType;
  contact_person: string | null;
  phone: string | null;
  cut_off_time: string | null; // (HH:mm)
  status: ShippingPartnerStatus;
  speed_hours: number;
  base_fee: number;
}

// --- 5. Chi tiết (Output của RPC get_shipping_partner_details) ---
export interface ShippingPartnerDetailsData {
  partner: ShippingPartner;
  rules: ShippingRule[] | null;
}

// --- 6. Dữ liệu Form (Input cho RPC create/update) ---
export interface ShippingPartnerFormData {
  name: string;
  type: ShippingPartnerType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ShippingPartnerStatus;
  cut_off_time: string | null; // Dayjs object sẽ được format thành string
  speed_hours: number;
  base_fee: number;
}

// --- 7. Khuôn mẫu "Bộ não" (Store) ---
export interface ShippingPartnerStoreState {
  partners: ShippingPartnerListRecord[];
  loading: boolean;
  loadingDetails: boolean;
  isModalVisible: boolean; // Theo Canvas, Sếp dùng Modal
  editingPartner: ShippingPartnerDetailsData | null;
  totalCount: number;
  filters: any; // Hàm

  fetchPartners: (filters: any) => Promise<void>;
  getPartnerDetails: (id: number) => Promise<void>;
  createPartner: (
    data: ShippingPartnerFormData,
    rules: Omit<ShippingRule, "id">[]
  ) => Promise<number | null>;
  updatePartner: (
    id: number,
    data: ShippingPartnerFormData,
    rules: Omit<ShippingRule, "id">[]
  ) => Promise<boolean>;
  deletePartner: (id: number) => Promise<boolean>;
  reactivatePartner: (id: number) => Promise<boolean>; // Quản lý UI
  showModal: (record?: ShippingPartnerListRecord) => void;
  closeModal: () => void;
}
