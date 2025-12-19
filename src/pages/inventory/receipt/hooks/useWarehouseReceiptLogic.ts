// src/pages/inventory/receipt/hooks/useWarehouseReceiptLogic.ts
import { App } from "antd";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useWarehouseTools } from "@/features/inventory/hooks/useWarehouseTools";
import { supabase } from "@/shared/lib/supabaseClient";
import { inventoryService } from "@/features/inventory/api/inventoryService";
import { invoiceService } from "@/features/finance/api/invoiceService";
import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";

export interface ReceiptItem {
  key: string;
  product_id: number;
  product_name: string;
  sku: string;
  image_url?: string; // Thêm ảnh
  barcode?: string;
  uom: string;
  quantity_ordered: number;
  quantity_received: number;
  stock_management_type: "lot_date" | "serial" | "simple";
  lot_number: string;
  expiry_date: dayjs.Dayjs | null;
  evidence_url?: string;
}

export const useWarehouseReceiptLogic = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { poId } = useParams();

  const [loading, setLoading] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [isBulkScanLoading, setIsBulkScanLoading] = useState(false);

  const [isViewMode, setIsViewMode] = useState(false);
  const [receiptCode, setReceiptCode] = useState("");

  // Hook vũ khí (Voice, Cam, Barcode)
  const { scanning, isListening, startVoiceInput, scanLabel } =
    useWarehouseTools((code) => {
      if (!isViewMode) handleBarcodeScan(code);
    });

  // --- INIT ---
  useEffect(() => {
    if (!poId) return;
    initPageData(Number(poId));

    const channel = supabase
      .channel(`receipt_room_${poId}`)
      .on("presence", { event: "sync" }, () => {
        setActiveUserCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user: "me",
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [poId]);

  const initPageData = async (id: number) => {
    try {
      const po = await purchaseOrderService.getPODetail(id);
      setPoData(po);

      // Logic xác định chế độ Xem hay Nhập
      if (po.delivery_status === "delivered" || po.status === "COMPLETED") {
        setIsViewMode(true);
        await loadReceiptData(id);
      } else {
        setIsViewMode(false);
        loadItemsFromPO(po.items);
      }
    } catch (err) {
      message.error("Lỗi tải dữ liệu đơn hàng");
    }
  };

  const loadItemsFromPO = (poItems: any[]) => {
    const initItems = (poItems || []).map((i: any) => ({
      key: `${i.product_id}_1`,
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      image_url: i.image_url, // Map ảnh
      barcode: i.barcode,
      uom: i.uom_ordered || i.unit || "Hộp",
      quantity_ordered: i.quantity_ordered,
      quantity_received: i.quantity_ordered, // Mặc định nhập đủ
      stock_management_type: i.stock_management_type || "lot_date",
      lot_number: "",
      expiry_date: null,
    }));
    setItems(initItems);
  };

  const loadReceiptData = async (poId: number) => {
    try {
      const receipt = await inventoryService.getReceiptByPO(poId);
      if (receipt) {
        setReceiptCode(receipt.code);
        const receiptItems = (receipt.items || []).map(
          (i: any, idx: number) => ({
            key: `hist_${idx}`,
            product_id: i.product_id,
            product_name: i.product?.name || "Unknown",
            sku: i.product?.sku || "",
            image_url: i.product?.image_url, // Map ảnh
            uom: i.product?.retail_unit || "Đơn vị",
            quantity_ordered: 0,
            quantity_received: i.quantity,
            stock_management_type: "lot_date",
            lot_number: i.lot_number,
            expiry_date: i.expiry_date ? dayjs(i.expiry_date) : null,
          })
        );
        setItems(receiptItems);
      }
    } catch (error) {
      console.error("Error loading receipt", error);
    }
  };

  // --- HANDLERS ---
  const handleUpdateItem = (
    key: string,
    field: keyof ReceiptItem,
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSplitLine = (originItem: ReceiptItem) => {
    const newKey = `${originItem.product_id}_${Date.now()}`;
    const newItem = {
      ...originItem,
      key: newKey,
      quantity_received: 0,
      lot_number: "",
      expiry_date: null,
    };
    const index = items.findIndex((i) => i.key === originItem.key);
    const newItems = [...items];
    newItems.splice(index + 1, 0, newItem);
    setItems(newItems);
  };

  const handleBarcodeScan = (code: string) => {
    const targetItem = items.find((i) => i.barcode === code || i.sku === code);
    if (targetItem) {
      handleUpdateItem(
        targetItem.key,
        "quantity_received",
        (targetItem.quantity_received || 0) + 1
      );
      message.success(`Đã quét: ${targetItem.product_name} (+1)`);
    } else {
      message.warning(`Không tìm thấy sản phẩm: ${code}`);
    }
  };

  // Voice & Scan Handlers
  const handleVoiceRow = (key: string) => {
    startVoiceInput((text) => {
      const qtyMatch = text.match(/(?:số lượng|sl|nhập)\s+(\d+)/i);
      const lotMatch = text.match(/lô\s+([a-zA-Z0-9\-\.]+)/i);
      const dateNumbers = text.match(/\d+/g);

      let newQty = null;
      let newLot = "";
      let newDate = null;
      if (qtyMatch) newQty = Number(qtyMatch[1]);
      if (lotMatch) newLot = lotMatch[1];
      if (dateNumbers && dateNumbers.length >= 3) {
        const len = dateNumbers.length;
        const y = dateNumbers[len - 1];
        const m = dateNumbers[len - 2];
        const d = dateNumbers[len - 3];
        if (Number(y) > 2000) newDate = dayjs(`${y}-${m}-${d}`);
      }

      if (newQty !== null || newLot || newDate) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === key
              ? {
                  ...i,
                  quantity_received:
                    newQty !== null ? newQty : i.quantity_received,
                  lot_number: newLot || i.lot_number,
                  expiry_date: newDate || i.expiry_date,
                }
              : i
          )
        );
        message.success("Đã cập nhật từ giọng nói!");
      }
    });
  };

  const handleScanRow = async (key: string, file: File) => {
    const result = await scanLabel(file);
    if (result) {
      setItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                lot_number: result.lot_number || item.lot_number,
                expiry_date: result.expiry_date
                  ? dayjs(result.expiry_date)
                  : item.expiry_date,
                evidence_url: result.file_url,
              }
            : item
        )
      );
    }
  };

  const handleBulkScan = async (file: File) => {
    setIsBulkScanLoading(true);
    try {
      const publicUrl = await invoiceService.uploadInvoiceImage(file);
      const aiResult = await invoiceService.scanInvoiceWithAI(
        publicUrl,
        file.type
      );
      if (aiResult?.data?.items) {
        const scannedItems = aiResult.data.items;
        let matchCount = 0;
        setItems((prev) =>
          prev.map((receiptItem) => {
            const match = scannedItems.find((si: any) =>
              receiptItem.product_name
                .toLowerCase()
                .includes(si.name.toLowerCase())
            );
            if (match && (match.lot_number || match.expiry_date)) {
              matchCount++;
              return {
                ...receiptItem,
                lot_number: match.lot_number || receiptItem.lot_number,
                expiry_date: match.expiry_date
                  ? dayjs(match.expiry_date)
                  : receiptItem.expiry_date,
              };
            }
            return receiptItem;
          })
        );
        message.success(`Đã điền ${matchCount} dòng!`);
      }
    } catch (error) {
      message.error("Lỗi đọc hóa đơn.");
    } finally {
      setIsBulkScanLoading(false);
    }
    return false;
  };

  // SUBMIT
  const handleSubmit = async () => {
    const errors = items.filter(
      (i) =>
        i.stock_management_type === "lot_date" &&
        (!i.lot_number || !i.expiry_date)
    );
    if (errors.length > 0)
      return message.error(`Thiếu Lô/Hạn của ${errors.length} sản phẩm!`);

    setLoading(true);
    try {
      const payload = {
        po_id: Number(poId),
        warehouse_id: 1, // Mặc định kho 1 (hoặc lấy từ user context)
        note: "Nhập kho thực tế",
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity_received,
          lot_number: i.lot_number,
          expiry_date: i.expiry_date
            ? i.expiry_date.format("YYYY-MM-DD")
            : null,
        })),
      };
      await inventoryService.createReceipt(payload);
      message.success("Nhập kho thành công!");
      navigate("/inventory/inbound");
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi nhập kho: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    poData,
    items,
    setItems,
    loading,
    activeUserCount,
    isBulkScanLoading,
    isViewMode,
    receiptCode,
    scanning,
    isListening,
    handleUpdateItem,
    handleSplitLine,
    handleVoiceRow,
    handleScanRow,
    handleBulkScan,
    handleSubmit,
  };
};
