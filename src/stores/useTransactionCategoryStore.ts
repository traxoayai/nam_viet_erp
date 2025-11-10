// src/stores/useTransactionCategoryStore.ts
import { create } from "zustand";

import * as service from "@/services/transactionCategoryService";
import {
  TransactionCategoryStoreState,
  CoaAccount,
  CoaNode,
  TransactionCategoryRecord,
} from "@/types/transactionCategory";

// --- LOGIC NỘI BỘ: Build cây HTTK (COA) ---
const buildCoaTree = (list: CoaAccount[]): CoaNode[] => {
  const map: { [key: string]: CoaNode } = {};
  const roots: CoaNode[] = [];

  list.forEach((node) => {
    map[node.id] = {
      title: `${node.account_code} - ${node.name}`,
      value: node.account_code, // Dùng account_code làm value
      key: node.id,
      type: node.type,
      disabled: !node.allow_posting, // Vô hiệu hóa TK cha (tổng hợp)
      children: [],
    };
  });

  list.forEach((node) => {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children!.push(map[node.id]);
    } else {
      roots.push(map[node.id]);
    }
  });

  // Xóa mảng children rỗng
  Object.values(map).forEach((node) => {
    if (node.children && node.children.length === 0) {
      delete node.children;
    }
  });

  return roots;
};

// --- LOGIC NỘI BỘ: Lọc cây HTTK (theo "canvas") ---
const filterCoaTree = (nodes: CoaNode[], type: "thu" | "chi"): CoaNode[] => {
  const allowedTypes =
    type === "thu"
      ? ["TaiSan", "DoanhThu"] // THU: Lấy TK Tài sản (1xx) & Doanh thu (5xx, 7xx)
      : ["TaiSan", "NoPhaiTra", "ChiPhi"]; // CHI: Lấy TK Tài sản (1xx), Nợ (3xx) & Chi phí (6xx, 8xx)

  const filterRecursive = (nodesToFilter: CoaNode[]): CoaNode[] => {
    return nodesToFilter
      .filter((node) => {
        // Giữ node cha nếu nó có con hợp lệ
        if (node.children && node.children.length > 0) {
          node.children = filterRecursive(node.children);
          return node.children.length > 0;
        }
        // Giữ node con nếu nó hợp lệ
        return allowedTypes.includes(node.type);
      })
      .map((node) => ({ ...node })); // Tạo bản sao
  };

  return filterRecursive(nodes);
};

// --- BỘ NÃO (STORE) ---
export const useTransactionCategoryStore =
  create<TransactionCategoryStoreState>((set, get) => ({
    categories: [],
    masterCoaTree: [],
    filteredCoaTree: [],
    loading: false,
    isModalVisible: false,
    editingRecord: null,
    modalCategoryType: "chi",

    fetchCategories: async () => {
      set({ loading: true });
      try {
        const data = await service.fetchCategories();
        // Lấy tên TK Kế toán (tạm thời, sẽ tối ưu sau)
        const coaAccounts = await service.fetchCoaAccounts();
        const coaMap = new Map(
          coaAccounts.map((a) => [
            a.account_code,
            `${a.account_code} - ${a.name}`,
          ])
        );

        const records = data.map((cat) => ({
          ...cat,
          key: cat.id,
          accountName: cat.account_id ? coaMap.get(cat.account_id) : "N/A",
        }));
        set({ categories: records, loading: false });
      } catch (error) {
        console.error(error);
        set({ loading: false });
      }
    },

    fetchCoaTree: async () => {
      try {
        const coaAccounts = await service.fetchCoaAccounts();
        const tree = buildCoaTree(coaAccounts);
        set({ masterCoaTree: tree });
        // Lọc cây theo type mặc định
        get().setModalCategoryType(get().modalCategoryType);
      } catch (error) {
        console.error("Lỗi tải cây HTTK:", error);
      }
    },

    setModalCategoryType: (type: "thu" | "chi") => {
      set((state) => ({
        modalCategoryType: type,
        // Lọc và cập nhật cây đã lọc
        filteredCoaTree: filterCoaTree(state.masterCoaTree, type),
      }));
    },

    showAddModal: () => {
      set({
        isModalVisible: true,
        editingRecord: null,
        modalCategoryType: "chi",
      });
      get().setModalCategoryType("chi"); // Lọc mặc định cho modal Thêm mới
    },
    showEditModal: (record: TransactionCategoryRecord) => {
      set({
        isModalVisible: true,
        editingRecord: record,
        modalCategoryType: record.type,
      });
      get().setModalCategoryType(record.type); // Lọc theo type của record
    },
    closeModal: () => {
      set({ isModalVisible: false, editingRecord: null });
    },

    addCategory: async (values) => {
      set({ loading: true });
      try {
        await service.addCategory(values);
        await get().fetchCategories();
        set({ loading: false, isModalVisible: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },

    updateCategory: async (id, values) => {
      set({ loading: true });
      try {
        await service.updateCategory(id, values);
        await get().fetchCategories();
        set({ loading: false, isModalVisible: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },

    deleteCategory: async (id) => {
      set({ loading: true });
      try {
        await service.deleteCategory(id);
        await get().fetchCategories();
        set({ loading: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },
  }));
