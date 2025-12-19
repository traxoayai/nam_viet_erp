// src/types/transactionCategory.ts

// Dữ liệu thô từ CSDL
export interface TransactionCategory {
  id: number;
  code: string;
  name: string;
  type: "thu" | "chi";
  account_id: string | null; // Mã TK Kế toán (vd: "5111")
  status: "active" | "inactive";
  description: string | null;
}

// Kiểu dữ liệu AntD Table cần (thêm 'key' và tên TK)
export interface TransactionCategoryRecord extends TransactionCategory {
  key: React.Key;
  accountName?: string; // Tên TK Kế toán (vd: "5111 - Doanh thu bán hàng")
}

// Dữ liệu thô của 1 Tài khoản Kế toán (từ CSDL)
export interface CoaAccount {
  id: string; // UUID
  account_code: string;
  name: string;
  parent_id: string | null;
  // Dùng để lọc theo "canvas" của Sếp
  type: "TaiSan" | "NoPhaiTra" | "VonChuSoHuu" | "DoanhThu" | "ChiPhi";
  allow_posting: boolean;
}

// Dạng cây cho TreeSelect
export interface CoaNode {
  title: string;
  value: string;
  key: string;
  type: CoaAccount["type"]; // Giữ lại 'type' để lọc
  disabled: boolean;
  children?: CoaNode[];
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface TransactionCategoryStoreState {
  categories: TransactionCategoryRecord[];
  masterCoaTree: CoaNode[]; // Cây HTTK (chưa lọc)
  filteredCoaTree: CoaNode[]; // Cây HTTK (đã lọc)
  loading: boolean;
  isModalVisible: boolean;
  editingRecord: TransactionCategoryRecord | null;
  modalCategoryType: "thu" | "chi"; // Dùng để lọc TreeSelect trong Modal

  // --- Hàm hành động ---
  fetchCategories: () => Promise<void>;
  fetchCoaTree: () => Promise<void>; // Tải cây HTTK
  setModalCategoryType: (type: "thu" | "chi") => void; // Hàm lọc cây

  showAddModal: () => void;
  showEditModal: (record: TransactionCategoryRecord) => void;
  closeModal: () => void;

  addCategory: (values: any) => Promise<boolean>;
  updateCategory: (id: number, values: any) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
}
