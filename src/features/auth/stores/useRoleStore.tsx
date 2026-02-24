// src/stores/useRoleStore.ts
import {
  SafetyCertificateOutlined,
  ShopOutlined,
  MedicineBoxOutlined,
  ApartmentOutlined,
  AccountBookOutlined,
  SettingOutlined,
  ThunderboltOutlined, // [NEW]
} from "@ant-design/icons";
import { create } from "zustand";

import * as roleService from "@/features/auth/api/roleService";
import {
  RoleStoreState,
  Permission,
  PermissionNode,
  Role,
} from "@/features/auth/types/role";

// 1. Cấu hình Mapping & Icon
const MODULE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> =
  {
    finance: { label: "Tài Chính & Kế Toán", icon: <AccountBookOutlined /> },
    pos: { label: "Bán Hàng POS", icon: <ShopOutlined /> },
    medical: { label: "Y Tế & Phòng Khám", icon: <MedicineBoxOutlined /> },
    inventory: { label: "Kho & Sản Phẩm", icon: <ApartmentOutlined /> },
    settings: { label: "Cấu hình Hệ thống", icon: <SettingOutlined /> },
    marketing: { label: "Marketing & Nội dung", icon: <ShopOutlined /> }, // [NEW]
    order: { label: "Đơn Hàng", icon: <AccountBookOutlined /> }, // [NEW]
    quick: { label: "Thao Tác Nhanh", icon: <ThunderboltOutlined /> }, // [NEW]
  };

// 2. Cấu hình Highlight (QUAN TRỌNG)
const PERMISSION_HIGHLIGHTS: Record<string, { color: string; label?: string }> =
  {
    "finance.approve": { color: "#faad14" }, // Vàng
    "finance.execute": { color: "#ff4d4f" }, // Đỏ
  };

// --- LOGIC NỘI BỘ ---
const buildPermissionTree = (permissions: Permission[]): PermissionNode[] => {
  const moduleMap: { [key: string]: Permission[] } = {};

  permissions.forEach((p) => {
    // Chuẩn hóa module key (fallback 'other') + [FIX] Lowercase để tránh trùng lặp
    const modKey = (p.module || "other").toLowerCase();
    if (!moduleMap[modKey]) moduleMap[modKey] = [];
    moduleMap[modKey].push(p);
  });

  return Object.keys(moduleMap).map((moduleKey) => {
    const permissionsInModule = moduleMap[moduleKey];
    const config = MODULE_CONFIG[moduleKey] || {
      label: moduleKey.toUpperCase(),
      icon: <SafetyCertificateOutlined />,
    };

    // Tạo Key Nhóm (Prefix 'GROUP_' để dễ lọc)
    const groupKey = `GROUP_${moduleKey}`;

    return {
      title: <span style={{ fontWeight: "bold" }}>{config.label}</span>,
      key: groupKey, // Key ảo
      icon: config.icon,
      children: permissionsInModule.map((p) => {
        // Xử lý Highlight
        const highlight = PERMISSION_HIGHLIGHTS[p.key];
        const displayTitle = highlight ? (
          <span style={{ color: highlight.color, fontWeight: 600 }}>
            {p.name}
          </span>
        ) : (
          p.name
        );

        return {
          title: displayTitle,
          key: p.key, // Key thật (VD: finance.approve)
          icon: null,
          children: [],
        };
      }),
    };
  });
};

export const useRoleStore = create<RoleStoreState>((set, get) => ({
  roles: [],
  permissionsTree: [],
  selectedRole: null,
  checkedKeys: {},
  loadingRoles: false,
  loadingPermissions: false,
  loadingSaving: false,

  fetchRoles: async () => {
    set({ loadingRoles: true });
    try {
      const roles = await roleService.fetchRoles();
      set({ roles, loadingRoles: false });
    } catch (error) {
      console.error(error);
      set({ loadingRoles: false });
    }
  },

  fetchPermissions: async () => {
    set({ loadingPermissions: true });
    try {
      const flatPermissions = await roleService.fetchPermissions();
      const tree = buildPermissionTree(flatPermissions);
      set({ permissionsTree: tree, loadingPermissions: false });
    } catch (error) {
      console.error(error);
      set({ loadingPermissions: false });
    }
  },

  selectRole: async (role: Role) => {
    set({ selectedRole: role, loadingPermissions: true });
    try {
      const keys = await roleService.fetchRolePermissions(role.id);
      set((state) => ({
        checkedKeys: {
          ...state.checkedKeys,
          [role.id]: keys,
        },
        loadingPermissions: false,
      }));
    } catch (error) {
      console.error(error);
      set({ loadingPermissions: false });
    }
  },

  setCheckedKeysForRole: (keys: string[]) => {
    const roleId = get().selectedRole?.id;
    if (roleId) {
      set((state) => ({
        checkedKeys: {
          ...state.checkedKeys,
          [roleId]: keys, // Antd trả về cả key cha và key con
        },
      }));
    }
  },

  handleSavePermissions: async () => {
    const { selectedRole, checkedKeys } = get();
    if (!selectedRole) return false;

    set({ loadingSaving: true });
    try {
      const rawKeys = checkedKeys[selectedRole.id] || [];

      // [FIX LỖI 23503] Lọc bỏ các Key ảo (bắt đầu bằng GROUP_)
      const realKeys = rawKeys.filter((k) => !k.startsWith("GROUP_"));

      await roleService.savePermissionsForRole(selectedRole.id, realKeys);
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loadingSaving: false });
      return false;
    }
  },

  // ... (Giữ nguyên các hàm addRole, updateRole, deleteRole) ...
  addRole: async (values) => {
    // ... code cũ ...
    set({ loadingSaving: true });
    try {
      await roleService.addRole(values);
      await get().fetchRoles();
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      set({ loadingSaving: false });
      return false;
    }
  },
  updateRole: async (id, values) => {
    // ... code cũ ...
    set({ loadingSaving: true });
    try {
      await roleService.updateRole(id, values);
      await get().fetchRoles();
      if (get().selectedRole?.id === id) {
        set((state) => ({
          selectedRole: { ...state.selectedRole!, ...values },
        }));
      }
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      set({ loadingSaving: false });
      return false;
    }
  },
  deleteRole: async (id) => {
    // ... code cũ ...
    set({ loadingSaving: true });
    try {
      await roleService.deleteRole(id);
      await get().fetchRoles();
      if (get().selectedRole?.id === id) {
        set({ selectedRole: null });
      }
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      set({ loadingSaving: false });
      return false;
    }
  },
}));
