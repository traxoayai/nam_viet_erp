// src/features/inventory/hooks/useInboundDetail.ts
import { message, Modal } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

dayjs.extend(customParseFormat);

import { useInboundStore } from "../stores/useInboundStore";

import { invoiceService } from "@/features/finance/api/invoiceService";
import { inboundService } from "@/features/inventory/api/inboundService";
import { InboundDetailItem } from "@/features/inventory/types/inbound";
import { DEFAULT_WAREHOUSE_ID } from "@/shared/constants/defaults";
import { safeRpc } from "@/shared/lib/safeRpc";

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
  const [isDocScanning, setIsDocScanning] = useState(false);

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
      (i) =>
        i.stock_management_type === "lot_date" &&
        (i.input_quantity || 0) > 0 &&
        (!i.input_lot || !i.input_expiry)
    );

    if (errors.length > 0) {
      message.error(
        `Thiếu Lô/Hạn sử dụng của ${errors.length} sản phẩm đang nhập!`
      );
      return;
    }

    // 2. Lọc chỉ lấy những món có nhập số lượng > 0
    const itemsToReceive = workingItems.filter(
      (i) => (i.input_quantity || 0) > 0
    );

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
            p_warehouse_id: DEFAULT_WAREHOUSE_ID, // Default hoặc lấy từ context
            p_items: itemsToReceive.map((item) => {
              const i = item as InboundDetailItem & {
                uom?: string;
                unit_price?: number;
              };
              const unit = i.uom || i.unit;
              if (!unit) {
                throw new Error(
                  `Sản phẩm ${i.product_name || i.product_id}: thiếu đơn vị (uom). ` +
                    `Không thể nhập kho — kiểm tra lại đơn vị trong PO.`
                );
              }
              return {
                product_id: i.product_id,
                quantity: i.input_quantity || 0,
                unit, // không hard-code "Hộp" — fail-closed nếu thiếu để upstream lộ bug
                unit_price: i.unit_price || i.final_unit_cost || 0,
                lot_number: i.input_lot || "DEFAULT",
                expiry_date: i.input_expiry
                  ? dayjs(i.input_expiry, [
                      "DD/MM/YYYY",
                      "YYYY-MM-DDTHH:mm:ss.SSSZ",
                      "YYYY-MM-DD",
                      "YYYY-MM-DDTHH:mm:ssZ",
                    ]).isValid()
                    ? dayjs(i.input_expiry, [
                        "DD/MM/YYYY",
                        "YYYY-MM-DDTHH:mm:ss.SSSZ",
                        "YYYY-MM-DD",
                        "YYYY-MM-DDTHH:mm:ssZ",
                      ]).format("YYYY-MM-DD")
                    : dayjs(i.input_expiry).format("YYYY-MM-DD") // fallback
                  : "2099-12-31",
              };
            }),
          };

          // 5. GỌI ĐÚNG SERVICE MỚI
          await inboundService.submitReceipt(payload);

          message.success(
            "Nhập kho thành công! Hệ thống đã tự động tính quy đổi và cộng Tồn kho."
          );
          navigate("/inventory/inbound");
        } catch (error: unknown) {
          console.error(error);
          const msg = error instanceof Error ? error.message : String(error);
          message.error("Lỗi nhập kho: " + msg);
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const handleSaveDraft = async () => {
    if (!id) return;
    try {
      await safeRpc("save_inbound_draft", {
        p_po_id: Number(id),
        p_draft_data: workingItems as unknown,
      });
      message.success("Đã lưu nháp.");
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      message.error("Lỗi lưu nháp: " + msg);
    }
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

  // Upload phiếu xuất kho NCC (ảnh/PDF) → AI scan → auto-fill lot/expiry
  // và quantity (nếu chưa nhập) cho từng dòng theo fuzzy match tên SP.
  // Dùng mode='extract_only' nên KHÔNG tạo finance_invoices draft.
  const handleDocUpload = async (file: File) => {
    if (!file || file.size === 0) {
      message.error("File không hợp lệ.");
      return false;
    }
    setIsDocScanning(true);
    const hide = message.loading("Đang đọc phiếu giao hàng (AI)...", 0);
    try {
      const publicUrl = await invoiceService.uploadInvoiceImage(file);
      const aiResult = await invoiceService.scanInvoiceWithAI(
        publicUrl,
        file.type,
        { mode: "extract_only" }
      );
      const scannedItems: Array<{
        name?: string;
        lot_number?: string;
        expiry_date?: string;
        quantity?: number;
      }> = aiResult?.data?.items ?? [];
      if (scannedItems.length === 0) {
        message.warning("AI không nhận diện được dòng hàng nào trong phiếu.");
        return false;
      }

      // Bidirectional fuzzy match: receipt name include AI name HOẶC AI name
      // include receipt name (token đầu tiên) → tránh trường hợp 1 bên dài
      // hơn miss khớp.
      const norm = (s: string | undefined | null) =>
        (s ?? "").toLowerCase().trim();
      let matchCount = 0;
      let filledLot = 0;
      let filledExp = 0;
      let filledQty = 0;
      for (const ri of workingItems) {
        const rn = norm(ri.product_name);
        if (!rn) continue;
        const match = scannedItems.find((si) => {
          const sn = norm(si.name);
          if (!sn) return false;
          return rn.includes(sn) || sn.includes(rn);
        });
        if (!match) continue;
        const patch: Partial<typeof ri> = {};
        if (match.lot_number && !ri.input_lot) {
          patch.input_lot = String(match.lot_number);
          filledLot++;
        }
        if (match.expiry_date && !ri.input_expiry) {
          patch.input_expiry = String(match.expiry_date);
          filledExp++;
        }
        if (
          typeof match.quantity === "number" &&
          match.quantity > 0 &&
          !ri.input_quantity
        ) {
          patch.input_quantity = Number(match.quantity);
          filledQty++;
        }
        if (Object.keys(patch).length > 0) {
          updateWorkingItem(ri.product_id, patch);
          matchCount++;
        }
      }

      message.success(
        `Đã đối chiếu ${matchCount}/${workingItems.length} dòng — ` +
          `điền ${filledLot} lô, ${filledExp} HSD, ${filledQty} số lượng.`
      );
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      message.error("Không đọc được phiếu: " + msg);
    } finally {
      hide();
      setIsDocScanning(false);
    }
    return false; // Prevent default Antd Upload behavior (don't auto upload)
  };

  return {
    detail,
    workingItems,
    loading,
    error,
    isSubmitting,
    isDocScanning,
    updateWorkingItem,
    handleSubmit,
    handleSaveDraft,
    // AI Tools
    handleVoiceCommand,
    handleCameraScan,
    handleDocUpload,
    refetch: () => id && fetchDetail(parseInt(id, 10)),
  };
};
