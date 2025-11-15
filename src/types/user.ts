// src/types/user.ts

// Dữ liệu 1 hàng gán quyền (từ RPC 'get_users_with_roles')
export interface UserAssignment {
  branchId: number;
  branchName: string;
  roleId: string; // UUID
  roleName: string;
}

// Dữ liệu 1 user (từ RPC 'get_users_with_roles')
export interface UserRoleInfo {
  key: string; // user_id
  name: string;
  email: string;
  avatar: string | null;
  status: "pending_approval" | "active" | "inactive"; // Sẽ nâng cấp sau
  assignments: UserAssignment[] | null; // Mảng các quyền
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface UserStoreState {
  users: UserRoleInfo[];
  loadingUsers: boolean;
  isUserModalVisible: boolean;
  isAddUserModalVisible: boolean;
  editingUser: UserRoleInfo | null;

  // --- Hàm hành động ---
  fetchUsers: () => Promise<void>;
  showAddUserModal: () => void;
  showEditUserModal: (user: UserRoleInfo) => void;
  closeModals: () => void;

  // --- CRUD ---
  createUser: (values: {
    name: string;
    email: string;
    password: string;
  }) => Promise<boolean>;
  updateAssignments: (userId: string, assignments: any[]) => Promise<boolean>;
  updateUserStatus: (userId: string, status: string) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  approveUser: (userId: string) => Promise<boolean>;
}
