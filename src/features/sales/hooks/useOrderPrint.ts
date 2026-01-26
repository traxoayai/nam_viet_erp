import { message } from "antd";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates";
import { printHTML } from "@/shared/utils/printUtils";
import { supabase } from "@/shared/lib/supabaseClient";

export const useOrderPrint = () => {
  const printOrder = async (order: any) => {
    const hide = message.loading("Đang tính toán công nợ & tạo bản in...", 0);
    try {
        console.log("🖨️ PRINT DEBUG - Input Order:", order);

        // 1. Dò tìm Customer ID chuẩn xác
        // Trong List Page có thể nó nằm ở order.customer_id, hoặc order.customer.id
        const customerId = order.customer_id || order.customer?.id || order.partner_id;

        let oldDebt = 0;
        let totalDebtFromServer = 0;

        if (customerId) {
            // Gọi RPC lấy công nợ thực tế (Real-time)
            const { data, error } = await supabase.rpc('get_customer_debt_info', { 
                p_customer_id: Number(customerId) 
            });

            if (!error && data && data.length > 0) {
                 totalDebtFromServer = Number(data[0].current_debt) || 0;
                 console.log("💰 Debt from Server:", totalDebtFromServer);
            }
        }

        // 2. Logic tính "Nợ cũ" (Số nợ TRƯỚC KHI cộng đơn này vào)
        // Nếu đơn hàng CHƯA thanh toán (unpaid/debt) -> Nó đã nằm trong totalDebtFromServer.
        // -> Nợ cũ = Tổng nợ server - Giá trị đơn này.
        // Nếu đơn hàng ĐÃ thanh toán (paid) -> Nó không nằm trong nợ.
        // -> Nợ cũ = Tổng nợ server.
        
        const currentOrderUnpaidAmount = (order.payment_status === 'paid') 
            ? 0 
            : (Number(order.final_amount) - Number(order.paid_amount || 0));

        oldDebt = totalDebtFromServer - currentOrderUnpaidAmount;

        // Failsafe: Không để nợ cũ bị âm (trừ trường hợp trả thừa thật)
        // Nhưng thường hiển thị in ấn ta chỉ quan tâm số dương để đòi tiền.
        // if (oldDebt < 0) oldDebt = 0; 

        console.log("🧮 Calc: TotalServer", totalDebtFromServer, "- CurrentUnpaid", currentOrderUnpaidAmount, "= OldDebt", oldDebt);

        // 3. Chuẩn bị dữ liệu in
        const printData = {
            ...order,
            // Fallback tên sản phẩm
            items: (order.items || order.order_items || []).map((i: any) => ({
                ...i,
                product_name: i.product_name || i.product?.name || i.name || 'Sản phẩm',
                uom: i.uom || i.unit || 'ĐVT',
                quantity: i.quantity || 0,
                unit_price: Number(i.unit_price || i.price || 0),
                // Tính lại thành tiền cho chắc chắn
                total_line: (Number(i.quantity || 0) * Number(i.unit_price || i.price || 0)) - Number(i.discount || 0)
            })),
            // Quan trọng: Truyền số liệu đã tính vào template
            old_debt: oldDebt,
            final_amount: Number(order.final_amount || 0)
        };

        // 4. Gọi hàm tạo HTML & In
        const html = generateB2BOrderHTML(printData);
        printHTML(html);

    } catch (e: any) {
        console.error("Print Error:", e);
        message.error("Lỗi in đơn: " + e.message);
    } finally {
        hide();
    }
  };

  return { printOrder };
};