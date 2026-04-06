// src/features/purchasing/hooks/usePurchaseOrderMaster.ts
import { message } from "antd";
import { useState, useEffect, useRef } from "react";

import { PurchaseOrderMaster, PoLogisticsStat } from "../types/purchase";

import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

export const usePurchaseOrderMaster = () => {
  // --- STATE ---
  const [orders, setOrders] = useState<PurchaseOrderMaster[]>([]);
  const [logisticsStats, setLogisticsStats] = useState<PoLogisticsStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0,
  }); // Default pageSize 12 for grid
  const [filters, setFiltersRaw] = useState<{
    search?: string;
    status?: string;
    dateRange?: [string, string];
  }>({});

  // Wrapper: reset về page 1 mỗi khi filter thay đổi
  const setFilters = (newFilters: typeof filters) => {
    setFiltersRaw(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // --- ACTIONS ---

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const statusFilter = filters.status || "";

      let p_status: string | null = null;
      let p_status_delivery: string | null = null;
      let p_status_payment: string | null = null;

      if (statusFilter.startsWith("delivery:")) {
        p_status_delivery = statusFilter.replace("delivery:", "");
      } else if (statusFilter.startsWith("payment:")) {
        p_status_payment = statusFilter.replace("payment:", "");
      } else if (statusFilter) {
        p_status = statusFilter;
      }

      const { data: rpcData } = await safeRpc("get_purchase_orders_master", {
        p_page: pagination.page,
        p_page_size: pagination.pageSize,
        p_search: filters.search || "",
        p_status_delivery: p_status_delivery || "",
        p_status_payment: p_status_payment || "",
        p_status: p_status || "",
        p_date_from: filters.dateRange?.[0] || "",
        p_date_to: filters.dateRange?.[1] || "",
      });

      // Map dữ liệu & Total count
      // Giả sử item đầu tiên chứa full_count (kỹ thuật thường dùng trong Supabase RPC phân trang)
      const totalRows =
        rpcData && rpcData.length > 0 ? rpcData[0].full_count : 0;

      setOrders(rpcData as PurchaseOrderMaster[]);
      setPagination((prev) => ({ ...prev, total: totalRows }));
    } catch (err: any) {
      console.error("Fetch Orders Error:", err);
      message.error("Lỗi tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lấy thống kê Logistics từ RPC get_po_logistics_stats
   * Sử dụng cùng bộ lọc với danh sách
   */
  const fetchStats = async () => {
    try {
      const statusFilter = filters.status || "";
      let statsDelivery: string | null = null;
      let statsPayment: string | null = null;
      if (statusFilter.startsWith("delivery:")) {
        statsDelivery = statusFilter.replace("delivery:", "");
      } else if (statusFilter.startsWith("payment:")) {
        statsPayment = statusFilter.replace("payment:", "");
      } else if (statusFilter) {
        statsDelivery = statusFilter;
      }

      const { data } = await safeRpc("get_po_logistics_stats", {
        p_search: filters.search ?? undefined,
        p_status_delivery: statsDelivery ?? undefined,
        p_status_payment: statsPayment ?? undefined,
        p_date_from: filters.dateRange?.[0] ?? undefined,
        p_date_to: filters.dateRange?.[1] ?? undefined,
      });

      if (data) setLogisticsStats(data as PoLogisticsStat[]);
    } catch (err) {
      console.error("Stats Exception:", err);
    }
  };

  // --- EFFECTS ---

  // Tải lại dữ liệu khi Phân trang hoặc Bộ lọc thay đổi
  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [pagination.page, pagination.pageSize, filters]);

  // Realtime Subscription — stable, không phụ thuộc filters/pagination
  const fetchRef = useRef({ fetchOrders, fetchStats });
  fetchRef.current = { fetchOrders, fetchStats };

  useEffect(() => {
    const channel = supabase
      .channel("po_master_changes_v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_orders" },
        () => {
          fetchRef.current.fetchOrders();
          fetchRef.current.fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Subscribe 1 lần, dùng ref để luôn gọi phiên bản mới nhất

  // --- CRUD OPERATORS ---

  const deleteOrder = async (id: number) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);
      if (error) throw error;
      message.success("Đã xóa đơn hàng");
      // Refresh list locally
      fetchOrders();
      fetchStats();
    } catch {
      message.error("Không thể xóa đơn hàng");
    }
  };

  const updateLogistics = async (id: number) => {
    message.info(`TODO: Cập nhật vận chuyển cho ID ${id}`);
  };

  const autoCreate = async () => {
    try {
      message.loading({
        content: "Đang tính toán dự trù...",
        key: "auto_create",
      });
      const { data } = await safeRpc(
        "auto_create_purchase_orders_min_max"
      );
      message.success({
        content: `Đã tạo ${data} đơn hàng dự trù!`,
        key: "auto_create",
      });
      fetchOrders();
    } catch {
      message.error({ content: "Lỗi tạo đơn tự động", key: "auto_create" });
    }
  };

  return {
    orders,
    logisticsStats,
    loading,
    pagination,
    setPagination,
    filters,
    setFilters,
    fetchOrders,
    deleteOrder,
    updateLogistics,
    autoCreate,
  };
};
