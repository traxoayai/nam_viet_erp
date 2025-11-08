// src/stores/useRoleStore.ts
import {
  SafetyCertificateOutlined,
  ShopOutlined,
  MedicineBoxOutlined,
  ApartmentOutlined,
  AccountBookOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { create } from "zustand";

import * as roleService from "@/services/roleService";
import { RoleStoreState, Permission, PermissionNode, Role } from "@/types/role";

// --- LOGIC NỘI BỘ: Build cây Quyền hạn ---
const buildPermissionTree = (permissions: Permission[]): PermissionNode[] => {
  // 1. Nhóm các quyền theo module
  const moduleMap: { [key: string]: Permission[] } = {};
  permissions.forEach((p) => {
    if (!moduleMap[p.module]) {
      moduleMap[p.module] = [];
    }
    moduleMap[p.module].push(p);
  });

  // 2. Tạo icon map (theo "canvas" của Sếp)
  const iconMap: { [key: string]: React.ReactNode } = {
    "Module: Bán Hàng POS (Kênh Cửa Hàng)": <ShopOutlined />,
    "Module: Nghiệp vụ Y Tế (Phòng Khám)": <MedicineBoxOutlined />,
    "Module: Kho & Sản Phẩm": <ApartmentOutlined />,
    "Module: Tài Chính & Kế Toán": <AccountBookOutlined />,
    "Module: Cấu hình Hệ thống": <SettingOutlined />,
  };

  // 3. Xây dựng cây AntD
  return Object.keys(moduleMap).map((moduleName) => {
    const permissionsInModule = moduleMap[moduleName];
    // Tìm key cha (ví dụ: 'pos', 'clinic')
    const parentKey = permissionsInModule.find(
      (p) => p.key === p.key.split("-")[0]
    )?.key;

    return {
      title: moduleName,
      key: parentKey || moduleName, // Dùng key cha (vd: 'pos')
      icon: iconMap[moduleName] || <SafetyCertificateOutlined />,
      children: permissionsInModule
        .filter((p) => p.key !== parentKey) // Lọc bỏ key cha
        .map((p) => ({
          title: p.name,
          key: p.key,
          icon: undefined, // Không cần icon cho con
          children: [], // Không có con
        })),
    };
  });
};

// --- BỘ NÃO (STORE) ---
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
          [roleId]: keys,
        },
      }));
    }
  },

  handleSavePermissions: async () => {
    const { selectedRole, checkedKeys } = get();
    if (!selectedRole) return false; // Luôn trả về boolean

    set({ loadingSaving: true });
    try {
      const keysToSave = checkedKeys[selectedRole.id] || [];
      await roleService.savePermissionsForRole(selectedRole.id, keysToSave);
      set({ loadingSaving: false });
      return true; // Trả về true cho message.success
    } catch (error) {
      console.error(error);
      set({ loadingSaving: false });
      return false; // Trả về false cho message.error
    }
  },

  addRole: async (values) => {
    set({ loadingSaving: true });
    try {
      await roleService.addRole(values);
      await get().fetchRoles(); // Tải lại danh sách
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loadingSaving: false });
      return false;
    }
  },

  updateRole: async (id, values) => {
    set({ loadingSaving: true });
    try {
      await roleService.updateRole(id, values);
      await get().fetchRoles(); // Tải lại
      // Cập nhật lại vai trò đang chọn (nếu là nó)
      if (get().selectedRole?.id === id) {
        set((state) => ({
          selectedRole: { ...state.selectedRole!, ...values },
        }));
      }
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loadingSaving: false });
      return false;
    }
  },

  deleteRole: async (id: string) => {
    set({ loadingSaving: true });
    try {
      await roleService.deleteRole(id);
      await get().fetchRoles(); // Tải lại
      if (get().selectedRole?.id === id) {
        set({ selectedRole: null }); // Xóa lựa chọn nếu đã xóa
      }
      set({ loadingSaving: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loadingSaving: false });
      return false;
    }
  },
}));
