// src/features/inventory/hooks/useInboundDetail.ts
import { message, Modal } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    submitReceipt,
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
    // 1. Validation
    const hasInput = workingItems.some((i) => (i.input_quantity || 0) > 0);
    if (!hasInput) {
      message.error("Vui lòng nhập số lượng cho ít nhất 1 sản phẩm!");
      return;
    }

    const invalidItems = workingItems.filter((i) => {
      if ((i.input_quantity || 0) > 0) {
        if (i.stock_management_type === "lot_date") {
          if (!i.input_lot || !i.input_expiry) return true;
        }
      }
      return false;
    });

    if (invalidItems.length > 0) {
      message.error(
        `Sản phẩm "${invalidItems[0].product_name}" yêu cầu nhập Lô & Hạn sử dụng!`
      );
      return;
    }

    // 2. Submit
    Modal.confirm({
      title: "Xác nhận Nhập Kho",
      content: "Bạn có chắc chắn muốn xác nhận phiếu nhập này?",
      onOk: async () => {
        if (!id) return;
        setIsSubmitting(true);
        try {
          await submitReceipt(parseInt(id), 1);
          message.success("Nhập kho thành công!");
          navigate("/inventory/inbound");
        } catch (error: any) {
          message.error(error.message || "Lỗi nhập kho");
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
