// src/types/role.ts
import type { ReactNode } from "react";

// Dữ liệu thô từ bảng 'roles'
export interface Role {
  id: string; // UUID
  name: string;
  description: string | null;
  created_at?: string;
}

// Dữ liệu thô từ bảng 'permissions'
export interface Permission {
  key: string;
  name: string;
  module: string;
}

// Dữ liệu đã được build thành cây cho AntD Tree
export interface PermissionNode {
  title: string;
  key: string;
  icon: ReactNode;
  children: PermissionNode[];
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface RoleStoreState {
  roles: Role[];
  permissionsTree: PermissionNode[];
  selectedRole: Role | null;
  // Lưu trữ các key đã check cho TỪNG VAI TRÒ
  // Ví dụ: { "uuid-cua-admin": ["pos-view", "pos-create"], "uuid-duoc-si": ["pos-view"] }
  checkedKeys: { [roleId: string]: string[] };
  loadingRoles: boolean;
  loadingPermissions: boolean;
  loadingSaving: boolean;

  // --- Hàm hành động ---
  fetchRoles: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  selectRole: (role: Role) => Promise<void>;
  setCheckedKeysForRole: (keys: string[]) => void;
  handleSavePermissions: () => Promise<boolean>;
  addRole: (values: { name: string; description: string }) => Promise<boolean>;
  updateRole: (
    id: string,
    values: { name: string; description: string }
  ) => Promise<boolean>;
  deleteRole: (id: string) => Promise<boolean>;
}
