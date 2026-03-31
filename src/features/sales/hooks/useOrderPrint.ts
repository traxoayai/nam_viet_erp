import { message } from "antd";
import { safeRpc } from "@/shared/lib/safeRpc";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates";
import { printHTML } from "@/shared/utils/printUtils";
import { b2bService } from "@/features/sales/api/b2bService";

export const useOrderPrint = () => {
  const printOrder = async (order: any) => {
    const hide = message.loading("Đang đồng bộ dữ liệu in mới nhất...", 0);
    try {
      // [FIX TỐI THƯỢNG]: LUÔN LUÔN fetch Full Order Detail trước khi in 
      // để đảm bảo lấy đúng customer_id, uom, và trạng thái mới nhất.
      const fullOrder = await b2bService.getOrderDetail(order.id);
      const orderToPrint = { ...order, ...fullOrder };

      // 1. Lấy thông tin Nợ hiện tại từ Server
      let serverTotalDebt = 0;
      const customerId =
        orderToPrint.customer_id || orderToPrint.customer?.id || orderToPrint.partner_id;

      if (customerId) {
        try {
          const { data } = await safeRpc("get_customer_debt_info", {
            p_customer_id: Number(customerId),
          }, { silent: true });
          if (data && (data as any[]).length > 0) {
            serverTotalDebt = Number((data as any[])[0].current_debt) || 0;
          }
        } catch {
          // Ignore debt fetch error, proceed with 0
        }
      }

      // 2. Logic Hiển thị Nợ (QUAN TRỌNG)
      const isDebtRecorded = [
        "CONFIRMED",
        "SHIPPING",
        "DELIVERED",
        "COMPLETED",
      ].includes(orderToPrint.status);
      
      const thisOrderUnpaid =
        orderToPrint.payment_status === "paid"
          ? 0
          : Number(orderToPrint.final_amount) - Number(orderToPrint.paid_amount || 0);

      let oldDebtDisplay = 0;
      let totalPayableDisplay = 0;

      if (isDebtRecorded) {
        oldDebtDisplay = serverTotalDebt - thisOrderUnpaid;
        totalPayableDisplay = serverTotalDebt;
      } else {
        oldDebtDisplay = serverTotalDebt;
        totalPayableDisplay = serverTotalDebt + thisOrderUnpaid;
      }

      // 3. Map Data (Thêm Lô/Date)
      const printData = {
        ...orderToPrint,
        items: (orderToPrint.items || orderToPrint.order_items || []).map((i: any) => ({
          ...i,
          product_name:
            i.product_name || i.product?.name || i.name || "Sản phẩm",
          uom: i.uom || i.unit || "ĐVT",
          quantity: i.quantity || 0,
          unit_price: Number(i.unit_price || i.price || 0),
          total_line: i.total_line || (i.quantity || 0) * (i.unit_price || 0),
          batch_no: i.batch_no || i.lot_number || "",
          expiry_date: i.expiry_date || "",
        })),
        old_debt: oldDebtDisplay,
        total_payable_display: totalPayableDisplay,
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