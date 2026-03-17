// src/features/inventory/hooks/useInboundDetail.ts
import { message, Modal } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { inboundService } from "@/features/inventory/api/inboundService";
import { useInboundStore } from "../stores/useInboundStore";

export const useInboundDetail = (id?: string) => {
  const navigate = useNavigate();
  const {
    detail,
    loading,
    error,
    workingItems,
    fetchDetail,
    updateWorkingItem,
    resetDetail,
  } = useInboundStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        fetchDetail(numId);
      }
    }
    return () => resetDetail();
  }, [id]);

  const handleSubmit = async () => {
    // 1. Lọc và Validate (Ví dụ: check thiếu Lô/Date)
    const errors = workingItems.filter(
      (i) => i.stock_management_type === "lot_date" && (i.input_quantity || 0) > 0 && (!i.input_lot || !i.input_expiry)
    );
    
    if (errors.length > 0) {
      message.error(`Thiếu Lô/Hạn sử dụng của ${errors.length} sản phẩm đang nhập!`);
      return;
    }

    // 2. Lọc chỉ lấy những món có nhập số lượng > 0
    const itemsToReceive = workingItems.filter((i) => (i.input_quantity || 0) > 0);
    
    if (itemsToReceive.length === 0) {
       message.warning("Vui lòng nhập số lượng cho ít nhất 1 sản phẩm.");
       return;
    }

    // 3. Submit
    Modal.confirm({
      title: "Xác nhận Nhập Kho",
      content: "Bạn có chắc chắn muốn xác nhận phiếu nhập này?",
      onOk: async () => {
        if (!id) return;
        setIsSubmitting(true);
        try {
          // 4. Map Payload chuẩn cho process_inbound_receipt
          const payload = {
            p_po_id: Number(id),
            p_warehouse_id: 1, // Default hoặc lấy từ context
            p_items: itemsToReceive.map((item) => {
              const i = item as any;
              return {
                product_id: i.product_id,
                quantity: i.input_quantity || 0,
                unit: i.uom || i.unit || "Hộp", // Quan trọng: Truyền đúng Đơn vị để DB tính quy đổi
                unit_price: i.unit_price || i.final_unit_cost || 0,
                lot_number: i.input_lot || "DEFAULT", // Tránh null lỗi DB
                expiry_date: i.input_expiry ? dayjs(i.input_expiry).format("YYYY-MM-DD") : "2099-12-31",
              };
            }),
          };

          // 5. GỌI ĐÚNG SERVICE MỚI
          await inboundService.submitReceipt(payload);

          message.success("Nhập kho thành công! Hệ thống đã tự động tính quy đổi và cộng Tồn kho.");
          navigate("/inventory/inbound");
        } catch (error: any) {
          console.error(error);
          message.error("Lỗi nhập kho: " + error.message);
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  // --- AI HANDLERS (STUBS) ---
  const handleVoiceCommand = () => {
    message.info("Đang bật Voice Listener... (Tính năng Demo)");
    // Logic for Web Speech API would go here
  };

  const handleCameraScan = () => {
    message.info("Mở Camera AI... (Tính năng Demo)");
    // Open camera modal
  };

  const handleDocUpload = (_file: File) => {
    message.loading("Đang đọc phiếu giao hàng...");
    setTimeout(() => {
      message.success(
        "Đã trích xuất dữ liệu: Cập nhật số lượng cho 3 sản phẩm!"
      );
      // Mock update
      if (workingItems.length > 0) {
        updateWorkingItem(workingItems[0].product_id, { input_quantity: 50 });
      }
    }, 1500);
    return false; // Prevent upload
  };

  return {
    detail,
    workingItems,
    loading,
    error,
    isSubmitting,
    updateWorkingItem,
    handleSubmit,
    // AI Tools
    handleVoiceCommand,
    handleCameraScan,
    handleDocUpload,
    refetch: () => id && fetchDetail(parseInt(id, 10)),
  };
};
