import { message } from "antd";

import { b2bService } from "@/features/sales/api/b2bService";
import { safeRpc } from "@/shared/lib/safeRpc";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates";
import { openPrintWindow, renderAndPrint } from "@/shared/utils/printUtils";

interface PrintableOrder {
  id: string;
  customer_id?: string | number;
  customer?: { id?: string | number };
  partner_id?: string | number;
  status?: string;
  payment_status?: string;
  final_amount?: number;
  paid_amount?: number;
}

interface RawOrderItem {
  product_name?: string;
  product?: { name?: string };
  name?: string;
  uom?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
  total_line?: number;
  batch_no?: string;
  lot_number?: string;
  expiry_date?: string;
  shelf_location?: string;
}

interface DebtInfoRow {
  current_debt?: number | string | null;
}

export const useOrderPrint = () => {
  const printOrder = async (order: PrintableOrder) => {
    // Mở window NGAY trong user gesture (click) để không bị popup blocker chặn
    // sau các await bên dưới. Chrome chỉ cho phép window.open khi còn transient
    // user activation — activation sẽ mất sau await đầu tiên.
    const printWindow = openPrintWindow();
    if (!printWindow) return;

    const hide = message.loading("Đang đồng bộ dữ liệu in mới nhất...", 0);
    try {
      // [FIX TỐI THƯỢNG]: LUÔN LUÔN fetch Full Order Detail trước khi in
      // để đảm bảo lấy đúng customer_id, uom, và trạng thái mới nhất.
      const fullOrder = await b2bService.getOrderDetail(order.id);
      const orderToPrint = { ...order, ...fullOrder };

      // 1. Lấy thông tin Nợ hiện tại từ Server
      let serverTotalDebt = 0;
      const customerId =
        orderToPrint.customer_id ||
        orderToPrint.customer?.id ||
        orderToPrint.partner_id;

      if (customerId) {
        try {
          const { data } = await safeRpc(
            "get_customer_debt_info",
            {
              p_customer_id: Number(customerId),
            },
            { silent: true }
          );
          const rows = (data ?? []) as DebtInfoRow[];
          if (rows.length > 0) {
            serverTotalDebt = Number(rows[0]!.current_debt) || 0;
          }
        } catch {
          // Ignore debt fetch error, proceed with 0
        }
      }

      // 2. Logic Hiển thị Nợ (QUAN TRỌNG)
      const isDebtRecorded = [
        "CONFIRMED",
        "PACKED",
        "SHIPPING",
        "DELIVERED",
        "COMPLETED",
      ].includes(orderToPrint.status ?? "");

      const thisOrderUnpaid =
        orderToPrint.payment_status === "paid"
          ? 0
          : Number(orderToPrint.final_amount) -
            Number(orderToPrint.paid_amount || 0);

      let oldDebtDisplay = 0;
      let totalPayableDisplay = 0;

      if (isDebtRecorded) {
        oldDebtDisplay = serverTotalDebt - thisOrderUnpaid;
        totalPayableDisplay = serverTotalDebt;
      } else {
        oldDebtDisplay = serverTotalDebt;
        totalPayableDisplay = serverTotalDebt + thisOrderUnpaid;
      }

      // 3. Map Data (Thêm Lô/Date/Vị trí kệ — sort A-Z theo shelf_location ở
      //    template render để dược sĩ nhặt hàng theo trật tự kho)
      const orderItems = ((orderToPrint as { items?: RawOrderItem[] }).items ??
        (orderToPrint as { order_items?: RawOrderItem[] }).order_items ??
        []) as RawOrderItem[];
      const printData = {
        ...orderToPrint,
        items: orderItems.map((i) => ({
          ...i,
          product_name:
            i.product_name || i.product?.name || i.name || "Sản phẩm",
          uom: i.uom || i.unit || "ĐVT",
          quantity: i.quantity || 0,
          unit_price: Number(i.unit_price || i.price || 0),
          total_line: i.total_line || (i.quantity || 0) * (i.unit_price || 0),
          batch_no: i.batch_no || i.lot_number || "",
          expiry_date: i.expiry_date || "",
          shelf_location: i.shelf_location || "",
        })),
        old_debt: oldDebtDisplay,
        total_payable_display: totalPayableDisplay,
      };

      const html = generateB2BOrderHTML(printData);
      renderAndPrint(printWindow, html);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      message.error("Lỗi in: " + msg);
      printWindow.close();
    } finally {
      hide();
    }
  };
  return { printOrder };
};
