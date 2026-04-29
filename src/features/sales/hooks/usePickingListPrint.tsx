// src/features/sales/hooks/usePickingListPrint.tsx
import { message } from "antd";
import { useState } from "react";

import { salesService } from "../api/salesService";

import {
  OutboundOrderInfo,
  OutboundPickItem,
} from "@/features/inventory/types/outbound";

type ProductInventoryRow = {
  warehouse_id?: number | null;
  shelf_location?: string | null;
  stock_quantity?: number | null;
};

type RawOrderItem = {
  id?: string | number;
  quantity?: number;
  product?: {
    id?: number;
    sku?: string | null;
    name?: string | null;
    image_url?: string | null;
    wholesale_unit?: string | null;
    product_inventory?: ProductInventoryRow[];
  };
};

// Lấy shelf_location của ĐÚNG kho xuất hàng. Trong cùng kho, ưu tiên record
// có stock > 0; nếu không có, fallback record đầu tiên. Không có record nào
// thuộc kho xuất → null (KHÔNG guess sang kho khác).
export const pickShelfLocation = (
  invList: ProductInventoryRow[] | null | undefined,
  warehouseId: number | null | undefined
): string | null => {
  if (!Array.isArray(invList) || invList.length === 0) return null;
  if (warehouseId == null) return null;

  const sameWh = invList.filter(
    (inv) =>
      inv?.warehouse_id === warehouseId &&
      typeof inv.shelf_location === "string" &&
      inv.shelf_location.length > 0
  );
  if (sameWh.length === 0) return null;

  const withStock = sameWh.find((inv) => (inv.stock_quantity ?? 0) > 0);
  return (withStock ?? sameWh[0]).shelf_location ?? null;
};

export const usePickingListPrint = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  const [printData, setPrintData] = useState<{
    orderInfo: OutboundOrderInfo;
    items: OutboundPickItem[];
  } | null>(null);

  // 1. In từ Danh sách (Gọi API)
  const printById = async (orderId: string | number) => {
    try {
      setIsPrinting(true);
      const detail = await salesService.getOrderDetail(orderId);

      const mappedInfo: OutboundOrderInfo = {
        id: String(detail.id),
        code: detail.code || `DH-${detail.id}`,
        customer_name: detail.customer?.name || "Khách lẻ",
        delivery_address:
          detail.delivery_address || detail.customer?.shipping_address || "",
        note: detail.note || "",
        status: detail.status || "CONFIRMED",
        shipping_partner:
          (detail as unknown as { shipping_partner_name?: string })
            .shipping_partner_name || "Tự giao",
        shipping_phone: detail.customer?.phone || "",
        cutoff_time: "---",
        package_count: 0,
      };

      const orderWarehouseId =
        (detail as unknown as { warehouse_id?: number | null }).warehouse_id ??
        null;
      const rawItems = (detail.items || []) as RawOrderItem[];
      const mappedItems: OutboundPickItem[] = rawItems.map((i) => {
        const prod = i.product || {};

        const locationStr =
          pickShelfLocation(prod.product_inventory, orderWarehouseId) ?? "---";

        return {
          product_id: Number(prod.id || i.id),
          sku: prod.sku || "---",
          product_name: prod.name || "Sản phẩm",
          unit: prod.wholesale_unit || "Cái",
          quantity_ordered: Number(i.quantity),

          shelf_location: locationStr,

          barcode: "",
          quantity_picked: 0,
          image_url: prod.image_url || "",
        };
      });

      setPrintData({ orderInfo: mappedInfo, items: mappedItems });

      setTimeout(() => {
        window.print();
        setIsPrinting(false);
        setPrintData(null);
      }, 800);
    } catch (error) {
      console.error("Print Error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      message.error("Lỗi lấy thông tin đơn: " + msg);
      setIsPrinting(false);
    }
  };

  // 2. In từ Dữ liệu có sẵn
  const printByData = (
    orderInfo: Partial<OutboundOrderInfo>,
    items: OutboundPickItem[]
  ) => {
    setIsPrinting(true);

    const safeOrderInfo: OutboundOrderInfo = {
      id: String(orderInfo.id || "0"),
      code: orderInfo.code || "NEW",
      customer_name: orderInfo.customer_name || "Khách hàng",
      shipping_partner: orderInfo.shipping_partner || "",
      shipping_phone: orderInfo.shipping_phone || "",
      cutoff_time: orderInfo.cutoff_time || "",
      package_count: orderInfo.package_count || 0,
      delivery_address: orderInfo.delivery_address || "",
      note: orderInfo.note || "",
      status: orderInfo.status || "DRAFT",
    };

    setPrintData({ orderInfo: safeOrderInfo, items });

    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  return {
    isPrinting,
    printData,
    printById,
    printByData,
  };
};
