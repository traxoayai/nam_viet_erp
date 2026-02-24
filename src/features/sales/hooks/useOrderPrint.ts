import { message } from "antd";

import { supabase } from "@/shared/lib/supabaseClient";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates";
import { printHTML } from "@/shared/utils/printUtils";

export const useOrderPrint = () => {
  const printOrder = async (order: any) => {
    const hide = message.loading("Đang xử lý dữ liệu in...", 0);
    try {
      // 1. Lấy thông tin Nợ hiện tại từ Server
      let serverTotalDebt = 0;
      const customerId =
        order.customer_id || order.customer?.id || order.partner_id;

      if (customerId) {
        const { data } = await supabase.rpc("get_customer_debt_info", {
          p_customer_id: Number(customerId),
        });
        if (data && data.length > 0) {
          serverTotalDebt = Number(data[0].current_debt) || 0;
        }
      }

      // 2. Logic Hiển thị Nợ (QUAN TRỌNG)
      // - Nếu đơn hàng MỚI TẠO (Chưa chốt nợ): Nợ hiển thị = Nợ Server (Nợ cũ). Tổng = Nợ cũ + Đơn mới.
      // - Nếu đơn hàng LỊCH SỬ (Đã chốt nợ/Đã giao): Nợ Server đã bao gồm đơn này.
      //   -> Ta hiển thị Nợ Server là "Tổng dư nợ hiện tại".
      //   -> Dòng "Nợ cũ" sẽ được tính lùi: ServerDebt - Đơn này (nếu chưa trả).

      const isDebtRecorded = [
        "CONFIRMED",
        "SHIPPING",
        "DELIVERED",
        "COMPLETED",
      ].includes(order.status);
      const thisOrderUnpaid =
        order.payment_status === "paid"
          ? 0
          : Number(order.final_amount) - Number(order.paid_amount || 0);

      let oldDebtDisplay = 0;
      let totalPayableDisplay = 0;

      if (isDebtRecorded) {
        // Đơn đã tính nợ -> Tính ngược để ra nợ cũ
        oldDebtDisplay = serverTotalDebt - thisOrderUnpaid;
        totalPayableDisplay = serverTotalDebt;
      } else {
        // Đơn mới (Draft/Quote) -> Nợ server là nợ cũ
        oldDebtDisplay = serverTotalDebt;
        totalPayableDisplay = serverTotalDebt + thisOrderUnpaid;
      }

      // 3. Map Data (Thêm Lô/Date)
      const printData = {
        ...order,
        items: (order.items || order.order_items || []).map((i: any) => ({
          ...i,
          product_name:
            i.product_name || i.product?.name || i.name || "Sản phẩm",
          uom: i.uom || i.unit || "ĐVT",
          quantity: i.quantity || 0,
          unit_price: Number(i.unit_price || i.price || 0),
          total_line: i.total_line || (i.quantity || 0) * (i.unit_price || 0),
          // [NEW] Map Lô/Hạn dùng
          batch_no: i.batch_no || i.lot_number || "",
          expiry_date: i.expiry_date || "",
        })),
        old_debt: oldDebtDisplay,
        total_payable_display: totalPayableDisplay, // Truyền biến riêng để template dùng
      };

      const html = generateB2BOrderHTML(printData);
      printHTML(html);
    } catch (e: any) {
      console.error(e);
      message.error("Lỗi in: " + e.message);
    } finally {
      hide();
    }
  };
  return { printOrder };
};
