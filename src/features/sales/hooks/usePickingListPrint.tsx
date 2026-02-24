import { message } from "antd";
import { useState } from "react";

import { salesService } from "../api/salesService";

import {
  OutboundOrderInfo,
  OutboundPickItem,
} from "@/features/inventory/types/outbound";

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
        shipping_partner: detail.shipping_partner_name || "Tự giao",
        shipping_phone: detail.customer?.phone || "",
        cutoff_time: "---",
        package_count: 0,
      };

      const rawItems = detail.items || [];
      const mappedItems: OutboundPickItem[] = rawItems.map((i: any) => {
        const prod = i.product || {};

        // [FIX LOGIC VỊ TRÍ KỆ]
        // product_inventory là Array. Cần tìm vị trí phù hợp.
        let locationStr = "---";
        const invList = prod.product_inventory;

        if (Array.isArray(invList) && invList.length > 0) {
          // Ưu tiên 1: Lấy kho nào đang có tồn kho > 0
          const hasStockInv = invList.find(
            (inv: any) => inv.stock_quantity > 0
          );
          // Ưu tiên 2: Nếu không có, lấy cái đầu tiên
          const target = hasStockInv || invList[0];

          if (target && target.shelf_location) {
            locationStr = target.shelf_location;
          }
        }

        return {
          product_id: Number(prod.id || i.id),
          sku: prod.sku || "---",
          product_name: prod.name || "Sản phẩm",
          unit: prod.wholesale_unit || "Cái",
          quantity_ordered: Number(i.quantity),

          // Gán giá trị đã xử lý vào đây
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
    } catch (error: any) {
      console.error("Print Error:", error);
      message.error("Lỗi lấy thông tin đơn: " + error.message);
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
