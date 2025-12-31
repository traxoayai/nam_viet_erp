import { useState } from "react";
import { Row, Col, Button, message } from "antd";
import { WalletOutlined, QrcodeOutlined, PrinterOutlined, FileProtectOutlined, ReadOutlined } from "@ant-design/icons";
import { usePosCartStore } from "../../stores/usePosCartStore";
import { posService } from "../../api/posService";
import { PosCreateOrderPayload } from "../../types/pos.types";
import { printPosBill, printInstruction } from "@/shared/utils/printTemplates"; 
import { VatInvoiceModal } from "../modals/VatInvoiceModal";

export const PosActionToolbar = () => {
  const { items, customer, getTotals, clearCart, warehouseId } = usePosCartStore();
  const [showVatModal, setShowVatModal] = useState(false);

  // --- LOGIC BÁN HÀNG ---
  const handleCheckout = async (method: 'cash' | 'transfer' | 'debt') => {
     if (items.length === 0) return message.warning("Giỏ hàng trống!");
     if (!warehouseId) return message.error("Chưa chọn kho xuất hàng!");

     const totals = getTotals(); // Đã tự động trừ Voucher trong Store
     
     const payload: PosCreateOrderPayload = {
        p_order_type: 'POS',
        p_customer_b2c_id: customer?.id || null, 
        p_customer_b2b_id: null,
        p_payment_method: method,
        p_items: items.map(i => ({
            product_id: i.id,
            quantity: i.qty,
            uom: i.unit,
            unit_price: i.price,
            discount: 0 // Chiết khấu dòng (hiện tại chưa dùng, dùng voucher tổng)
        })),
        p_shipping_fee: 0,
        // Gửi tiền giảm giá xuống Server để lưu vào đơn
        p_discount_amount: totals.discountVal, 
        p_status: 'DELIVERED', 
        p_warehouse_id: warehouseId, 
     };

     try {
        message.loading({ content: "Đang xử lý...", key: 'pos_checkout' });
        await posService.createOrder(payload);
        message.success({ content: "Thanh toán thành công!", key: 'pos_checkout' });
        clearCart();
     } catch (err: any) {
        message.error({ content: "Lỗi: " + err.message, key: 'pos_checkout' });
     }
  };

  // --- LOGIC IN ẤN ---
  const handlePrintBill = () => {
      if (items.length === 0) return message.warning("Giỏ hàng trống");
      const totals = getTotals();
      const mockOrder = {
          code: 'PREVIEW',
          sub_total: totals.subTotal,
          discount_amount: totals.discountVal,
          final_amount: totals.grandTotal,
          items: items.map(i => ({ product_name: i.name, uom: i.unit, quantity: i.qty, unit_price: i.price }))
      };
      printPosBill(mockOrder);
  };

  const handlePrintInstructions = () => {
      if (items.length === 0) return message.warning("Giỏ hàng trống");
      items.forEach(item => {
          if (item.dosage) printInstruction(item.name, item.dosage);
      });
      message.success("Đang gửi lệnh in HDSD...");
  };

  return (
    <div style={{ marginTop: 12 }}>
       <VatInvoiceModal 
           visible={showVatModal} 
           onCancel={() => setShowVatModal(false)}
           orderItems={items}
           totalAmount={getTotals().grandTotal}
           customer={customer}
       />

       <Row gutter={[8, 8]}>
          {/* Hàng 1: Nút chức năng */}
          <Col span={8}>
              <Button block icon={<PrinterOutlined />} onClick={handlePrintBill}>In Bill (F11)</Button>
          </Col>
          <Col span={8}>
              <Button block icon={<ReadOutlined />} onClick={handlePrintInstructions}>In HDSD</Button>
          </Col>
          
          <Col span={8}><Button block icon={<FileProtectOutlined />} onClick={() => setShowVatModal(true)}>Lấy HĐ VAT</Button></Col>
          
          {/* Hàng 2: Thanh toán */}
          <Col span={12}>
             <Button type="primary" block size="large" icon={<WalletOutlined />} style={{ height: 60, background: '#fa8c16', fontSize: 16 }} onClick={() => handleCheckout('cash')}>
                TIỀN MẶT (F9)
             </Button>
          </Col>
          <Col span={12}>
             <Button block size="large" icon={<QrcodeOutlined />} style={{ height: 60, background: '#b5b7ff', fontSize: 16 }} onClick={() => handleCheckout('transfer')}>
                CK (F10)
             </Button>
          </Col>
       </Row>
    </div>
  );
};
