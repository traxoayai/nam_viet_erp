// src/features/purchasing/hooks/usePurchaseOrderMaster.ts
import { useState, useEffect } from "react";
import { message } from "antd";
import { supabase } from "@/shared/lib/supabaseClient";
import { PurchaseOrderMaster, PoLogisticsStat } from "../types/purchase";

export const usePurchaseOrderMaster = () => {
  // --- STATE ---
  const [orders, setOrders] = useState<PurchaseOrderMaster[]>([]);
  const [logisticsStats, setLogisticsStats] = useState<PoLogisticsStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0 }); // Default pageSize 12 for grid
  const [filters, setFilters] = useState<{ search?: string; status?: string; dateRange?: [string, string] }>({});

  // --- HELPERS ---
  // Kiểm tra xem trạng thái lọc có phải là trạng thái thanh toán không
  const isPaymentStatus = (status: string) => ["unpaid", "partial", "paid", "overpaid"].includes(status);
  // Kiểm tra xem trạng thái lọc có phải là trạng thái giao hàng không
  const isDeliveryStatus = (status: string) => ["pending", "partial", "delivered", "shipping", "cancelled"].includes(status);

  // --- ACTIONS ---

  /**
   * Lấy danh sách đơn mua hàng từ RPC get_purchase_orders_master
   * Mapping tham số lọc thông minh dựa trên keyword
   */
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const statusFilter = filters.status || "";
      
      // Logic mapping params
      const p_status_delivery = isDeliveryStatus(statusFilter) ? statusFilter : null;
      const p_status_payment = isPaymentStatus(statusFilter) ? statusFilter : null;
      
      // Nếu statusFilter không thuộc 2 nhóm trên (vd: 'new', 'ordering'), RPC hiện tại chưa hỗ trợ p_status.
      // Tạm thời gửi null nếu không khớp logic, hoặc cần backend update thêm p_status.
      // Ở đây tuân thủ strict requirement: map status string matches keywords.

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_purchase_orders_master", {
        p_page: pagination.page,
        p_page_size: pagination.pageSize,
        p_search: filters.search || null,
        p_status_delivery: p_status_delivery,
        p_status_payment: p_status_payment,
        p_date_from: filters.dateRange?.[0] || null,
        p_date_to: filters.dateRange?.[1] || null
      });

      if (rpcError) throw rpcError;

      // Map dữ liệu & Total count
      // Giả sử item đầu tiên chứa full_count (kỹ thuật thường dùng trong Supabase RPC phân trang)
      const totalRows = (rpcData && rpcData.length > 0) ? rpcData[0].full_count : 0;
      
      setOrders(rpcData as PurchaseOrderMaster[]);
      setPagination(prev => ({ ...prev, total: totalRows }));

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
          const { data, error } = await supabase.rpc("get_po_logistics_stats", {
              p_date_from: filters.dateRange?.[0] || null,
              p_date_to: filters.dateRange?.[1] || null,
              p_search: filters.search || null
          });
          
          if (error) {
              console.error("Fetch Stats Error:", error);
              return;
          }
          
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

  // Realtime Subscription (Tự động refresh khi có thay đổi)
  useEffect(() => {
    const channel = supabase
      .channel('po_master_changes_v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => {
            fetchOrders();
            fetchStats();
        }
      )
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [filters, pagination.page]); // Depend on filters to refresh current view context correctly

  // --- CRUD OPERATORS ---

  const deleteOrder = async (id: number) => {
      try {
          const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
          if (error) throw error;
          message.success("Đã xóa đơn hàng");
          // Refresh list locally
          fetchOrders();
          fetchStats();
      } catch (err) {
          message.error("Không thể xóa đơn hàng");
      }
  };
  
  const updateLogistics = async (id: number, _carrier: string, _tracking: string) => {
      message.info(`TODO: Cập nhật vận chuyển cho ID ${id}`);
  }
  
  const autoCreate = async () => {
      try {
          message.loading({ content: "Đang tính toán dự trù...", key: "auto_create" });
          const { data, error } = await supabase.rpc("auto_create_purchase_orders_min_max");
          if (error) throw error;
          message.success({ content: `Đã tạo ${data} đơn hàng dự trù!`, key: "auto_create" });
          fetchOrders();
      } catch (err) {
          message.error({ content: "Lỗi tạo đơn tự động", key: "auto_create" });
      }
  }

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
    autoCreate
  };
};
