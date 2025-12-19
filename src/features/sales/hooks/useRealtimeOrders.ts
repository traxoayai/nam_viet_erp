import { message } from "antd"; // Sử dụng AntD để thông báo như Tech Stack yêu cầu
import { useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient"; // Giả định file init supabase client

type OrderPayload = {
  new: {
    id: string;
    code: string;
    status: string;
    total_amount: number;
  };
  old: {
    id: string;
  } | null;
  eventType: "INSERT" | "UPDATE" | "DELETE";
};

/**
 * Hook lắng nghe sự thay đổi của bảng Orders
 * @param onOrderChange - Callback function để xử lý dữ liệu mới tại UI (ví dụ: cập nhật state danh sách)
 */
export const useRealtimeOrders = (onOrderChange?: (payload: any) => void) => {
  useEffect(() => {
    // 1. Khởi tạo kênh lắng nghe
    const channel = supabase
      .channel("realtime-orders") // Tên kênh tùy ý
      .on(
        "postgres_changes",
        {
          event: "*", // Lắng nghe mọi sự kiện: INSERT, UPDATE, DELETE
          schema: "public",
          table: "orders",
          // filter: 'status=eq.PENDING', // Có thể lọc cụ thể nếu cần
        },
        (payload) => {
          console.log("⚡ Realtime Order Update:", payload);

          const data = payload as unknown as OrderPayload;

          // Xử lý thông báo UI cơ bản
          if (data.eventType === "INSERT") {
            message.info(`Đơn hàng mới: ${data.new.code}`);
          } else if (data.eventType === "UPDATE") {
            message.info(
              `Cập nhật đơn hàng ${data.new.code}: ${data.new.status}`
            );
          }

          // Gọi callback để cập nhật State ở Component cha
          if (onOrderChange) {
            onOrderChange(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Đã kết nối tới luồng Orders Realtime");
        }
      });

    // 2. Dọn dẹp khi unmount component
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onOrderChange]);
};
