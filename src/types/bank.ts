// src/types/bank.ts

// Dữ liệu thô từ CSDL
export interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  short_name: string;
  logo: string | null;
  status: "active" | "hidden";
  transfer_supported: boolean;
  lookup_supported: boolean;
  created_at?: string;
  updated_at?: string;
}

// Kiểu dữ liệu AntD Table cần (thêm 'key')
export interface BankRecord extends Bank {
  key: React.Key;
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface BankStoreState {
  banks: BankRecord[];
  loading: boolean;
  isModalVisible: boolean;
  editingRecord: BankRecord | null;

  // --- Hàm hành động ---
  fetchBanks: () => Promise<void>;
  syncFromVietQR: () => Promise<number>; // Trả về số lượng đã đồng bộ
  showAddModal: () => void;
  showEditModal: (record: BankRecord) => void;
  closeModal: () => void;
  addBank: (
    values: Omit<Bank, "id" | "created_at" | "updated_at">
  ) => Promise<boolean>;
  updateBank: (
    id: number,
    values: Omit<Bank, "id" | "created_at" | "updated_at">
  ) => Promise<boolean>;
  deleteBank: (id: number) => Promise<boolean>;
}
