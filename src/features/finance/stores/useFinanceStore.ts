// src/stores/useFinanceStore.ts
import { message } from "antd";
import * as XLSX from "xlsx";
import { create } from "zustand";

import { supabase } from "@/shared/lib/supabaseClient";
import {
  TransactionRecord,
  CreateTransactionParams,
  TransactionFilter,
} from "@/features/finance/types/finance";
import { FundAccountRecord } from "@/features/finance/types/fundAccount";

import { financeService } from "@/features/finance/api/financeService"; // [NEW]

interface FinanceState {
  transactions: TransactionRecord[];
  funds: FundAccountRecord[];
  openAdvances: TransactionRecord[];
  loading: boolean;
  totalCount: number;
  filters: TransactionFilter;
  page: number;
  pageSize: number;

  fetchTransactions: () => Promise<void>;
  fetchFunds: () => Promise<void>;
  fetchOpenAdvances: (employeeId: string) => Promise<void>;
  createTransaction: (payload: CreateTransactionParams) => Promise<boolean>;
  deleteTransaction: (id: number) => Promise<boolean>;
  exportExcel: () => void;
  confirmTransaction: (
    id: number,
    targetStatus: "approved" | "completed"
  ) => Promise<boolean>;

  setFilters: (filters: Partial<TransactionFilter>) => void;
  setPage: (page: number) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  funds: [],
  openAdvances: [],
  loading: false,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {},

  fetchTransactions: async () => {
    set({ loading: true });
    const { filters, page, pageSize } = get();
    try {
      const { data, totalCount } = await financeService.getTransactions({
        page,
        pageSize,
        ...filters
      });

      set({ transactions: data || [], totalCount: totalCount, loading: false });
    } catch (err: any) {
      console.error("Lỗi tải lịch sử:", err);
      set({ loading: false });
    }
  },

  fetchFunds: async () => {
    const { data } = await supabase
      .from("fund_accounts")
      .select("*")
      .order("name");
    if (data) set({ funds: data.map((f: any) => ({ ...f, key: f.id })) });
  },

  // --- AURA FIX: Sửa logic lấy phiếu tạm ứng ---
  fetchOpenAdvances: async (employeeId: string) => {
    // Lấy các phiếu: Loại = Tạm ứng, Người = Nhân viên này, Dòng tiền = Chi, Trạng thái = Đã duyệt (Confirmed)
    // Loại bỏ các phiếu đã hủy hoặc đã hoàn tất (completed)
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("id, code, amount, transaction_date, description, status")
      .eq("business_type", "advance")
      .eq("partner_id", employeeId)
      .eq("flow", "out")
      .eq("status", "confirmed") // QUAN TRỌNG: Chỉ lấy phiếu đã được duyệt chi
      .order("transaction_date", { ascending: false });

    if (error) {
      console.error("Lỗi tải danh sách tạm ứng:", error);
    }

    console.log(`Tìm tạm ứng cho ${employeeId}:`, data); // Debug log
    set({ openAdvances: (data as any) || [] });
  },
  // --------------------------------------------

  createTransaction: async (payload) => {
    set({ loading: true });
    try {
      // 1. Gọi API tạo phiếu Hoàn ứng
      const { data: _newId, error } = await supabase.rpc(
        "create_finance_transaction",
        payload
      );

      if (error) throw error;

      // 2. AURA FIX: Chủ động cập nhật trạng thái phiếu Tạm ứng cũ thành 'completed'
      // (Phòng trường hợp RPC của CORE chưa cập nhật kịp)
      if (payload.p_ref_advance_id) {
        const { error: updateError } = await supabase
          .from("finance_transactions")
          .update({ status: "completed" })
          .eq("id", payload.p_ref_advance_id);

        if (updateError) {
          console.warn(
            "Không thể cập nhật phiếu cũ từ Client (có thể do RLS), chờ Server xử lý."
          );
        }
      }

      message.success("Lập phiếu thành công!");

      // 3. AURA FIX: Tải lại toàn bộ danh sách để thấy phiếu cũ đổi màu (quan trọng)
      // Thay vì chỉ thêm phiếu mới vào list, ta reload để cập nhật cả phiếu cũ
      await get().fetchTransactions();

      // Cập nhật lại số dư các quỹ
      get().fetchFunds();

      set({ loading: false });
      return true;
    } catch (err: any) {
      message.error("Lỗi: " + err.message);
      set({ loading: false });
      return false;
    }
  },

  confirmTransaction: async (
    id: number,
    targetStatus: "approved" | "completed"
  ) => {
    try {
      // Gọi RPC mới (Sếp nhớ nhắc CORE update RPC này nhận tham số p_status)
      const { error } = await supabase.rpc("confirm_finance_transaction", {
        p_id: id,
        p_target_status: targetStatus, // Truyền trạng thái mong muốn xuống
      });

      if (error) throw error;

      const msg =
        targetStatus === "approved" ? "Đã duyệt chi!" : "Giao dịch hoàn tất!";
      message.success(msg);

      // Cập nhật UI cục bộ
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id ? { ...t, status: targetStatus } : t
        ),
      }));

      // Nếu là completed thì mới cập nhật lại số dư quỹ
      if (targetStatus === "completed") {
        get().fetchFunds();
      }

      return true;
    } catch (err: any) {
      message.error("Lỗi: " + err.message);
      return false;
    }
  },

  deleteTransaction: async (id: number) => {
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      message.success("Đã hủy phiếu");
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id ? { ...t, status: "cancelled" } : t
        ),
      }));

      return true;
    } catch (err: any) {
      message.error("Lỗi xóa: " + err.message);
      return false;
    }
  },

  exportExcel: () => {
    const { transactions } = get();
    if (!transactions || transactions.length === 0) {
      message.warning("Chưa có dữ liệu!");
      return;
    }
    try {
      const dataToExport = transactions.map((t) => ({
        "Mã Phiếu": t.code || "",
        Ngày: t.transaction_date
          ? new Date(t.transaction_date).toLocaleDateString("vi-VN")
          : "",
        Loại: t.flow === "in" ? "Thu" : "Chi",
        "Nghiệp vụ": t.business_type || "",
        "Số tiền": t.amount || 0,
        Quỹ: t.fund_name || "",
        "Đối tượng": t.partner_name || "",
        "Diễn giải": t.description || "",
        "Trạng thái": t.status,
        "Người lập": t.created_by_name || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "GiaoDichTaiChinh");
      XLSX.writeFile(
        wb,
        `TaiChinh_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err: any) {
      console.error("Lỗi xuất Excel:", err);
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters }, page: 1 }));
    get().fetchTransactions();
  },

  setPage: (page) => {
    set({ page });
    get().fetchTransactions();
  },
}));
