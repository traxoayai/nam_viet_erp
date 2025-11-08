// src/stores/useUserStore.ts
import { create } from "zustand";

import * as userService from "@/services/userService";
import { UserRoleInfo, UserStoreState } from "@/types/user";

export const useUserStore = create<UserStoreState>((set, get) => ({
  users: [],
  loadingUsers: false,
  isUserModalVisible: false,
  isAddUserModalVisible: false,
  editingUser: null,

  fetchUsers: async () => {
    set({ loadingUsers: true });
    try {
      const users = await userService.fetchUsersWithRoles();
      set({ users, loadingUsers: false });
    } catch (error) {
      console.error(error);
      set({ loadingUsers: false });
    }
  },

  showAddUserModal: () => set({ isAddUserModalVisible: true }),

  showEditUserModal: (user: UserRoleInfo) => {
    set({ editingUser: user, isUserModalVisible: true });
  },

  closeModals: () => {
    set({
      isUserModalVisible: false,
      isAddUserModalVisible: false,
      editingUser: null,
    });
  },

  // --- VÁ LỖI: Đổi tên và logic hàm ---
  createUser: async (values: {
    name: string;
    email: string;
    password: string;
  }) => {
    set({ loadingUsers: true }); // Dùng loading chung
    try {
      // Gọi "Cỗ máy" API mới
      await userService.createNewUser(values);
      await get().fetchUsers(); // Tải lại danh sách
      set({ loadingUsers: false });
      return true;
    } catch (error) {
      console.error("Lỗi khi tạo user:", error);
      set({ loadingUsers: false });
      return false;
    }
  },
  // --- KẾT THÚC VÁ LỖI ---

  updateAssignments: async (userId, assignments) => {
    set({ loadingUsers: true });
    try {
      await userService.updateUserAssignments(userId, assignments);
      await get().fetchUsers(); // Tải lại
      set({ loadingUsers: false });
      return true;
    } catch (error) {
      console.error("Lỗi khi cập nhật phân quyền:", error);
      set({ loadingUsers: false });
      return false;
    }
  },

  deleteUser: async (userId) => {
    set({ loadingUsers: true });
    try {
      await userService.deleteAuthUser(userId);
      await get().fetchUsers(); // Tải lại
      set({ loadingUsers: false });
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa user:", error);
      set({ loadingUsers: false });
      return false;
    }
  },

  updateUserStatus: async (userId, status) => {
    // (Tạm thời)
    await userService.updateUserStatus(userId, status);
    // Cập nhật state tạm thời
    set((state) => ({
      users: state.users.map((u) =>
        u.key === userId
          ? { ...u, status: status as UserRoleInfo["status"] }
          : u
      ),
    }));
    return true;
  },
}));
