// src/types/fundAccount.ts

// Dữ liệu thô từ CSDL
export interface FundAccount {
  id: number;
  name: string;
  type: "cash" | "bank";
  location: string | null;
  account_number: string | null;
  bank_id: number | null; // <-- NÂNG CẤP
  initial_balance: number;
  balance: number;
  status: "active" | "locked";
  created_at?: string;
  updated_at?: string;
}

// Kiểu dữ liệu AntD Table cần (thêm 'key' và tên NH)
export interface FundAccountRecord extends FundAccount {
  key: React.Key;
  bankName?: string; // Tên Ngân hàng (lấy từ JOIN)
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface FundAccountStoreState {
  fundAccounts: FundAccountRecord[];
  loading: boolean;
  isModalVisible: boolean;
  editingRecord: FundAccountRecord | null;
  modalAccountType: "cash" | "bank"; // Để ẩn/hiện form

  // --- Hàm hành động ---
  fetchFundAccounts: () => Promise<void>;
  showAddModal: () => void;
  showEditModal: (record: FundAccountRecord) => void;
  closeModal: () => void;
  setModalAccountType: (type: "cash" | "bank") => void;

  addFundAccount: (values: any) => Promise<boolean>;
  updateFundAccount: (id: number, values: any) => Promise<boolean>;
  deleteFundAccount: (id: number) => Promise<boolean>;
}
