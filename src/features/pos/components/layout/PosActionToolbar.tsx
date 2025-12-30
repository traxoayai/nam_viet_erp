import { Row, Col, Button, message } from "antd";
import { WalletOutlined, QrcodeOutlined, PrinterOutlined } from "@ant-design/icons";
import { usePosCartStore } from "../../stores/usePosCartStore";
import { posService } from "../../api/posService";
import { PosCreateOrderPayload } from "../../types/pos.types";

export const PosActionToolbar = () => {
  const { items, customer, getTotals, clearCart } = usePosCartStore();

  const handleCheckout = async (method: 'cash' | 'transfer' | 'debt') => {
     if (items.length === 0) return message.warning("Giỏ hàng trống!");
     
     // Chuẩn bị payload theo chuẩn Core mới
     const totals = getTotals();
     const payload: PosCreateOrderPayload = {
        p_order_type: 'POS',
        p_customer_b2c_id: customer?.id || null, // Khách lẻ
        p_customer_b2b_id: null,
        p_payment_method: method,
        p_items: items.map(i => ({
            product_id: i.id,
            quantity: i.qty,
            uom: i.unit,
            unit_price: i.price,
            discount: 0 // Chưa xử lý chiết khấu dòng
        })),
        p_shipping_fee: 0,
        p_discount_amount: totals.discountVal,
        p_status: 'DELIVERED' // POS xong luôn
     };

     try {
        message.loading({ content: "Đang xử lý...", key: 'pos_checkout' });
        const orderId = await posService.createOrder(payload); // Gọi API mới
        
        message.success({ content: "Thanh toán thành công!", key: 'pos_checkout' });
        
        // TODO: Gọi hàm In Bill tại đây (truyền orderId hoặc data vừa tạo)
        console.log("In bill cho đơn:", orderId);
        
        clearCart();
     } catch (err: any) {
        message.error({ content: "Lỗi: " + err.message, key: 'pos_checkout' });
     }
  };

  return (
    <div style={{ marginTop: 12 }}>
       <Row gutter={[8, 8]}>
          <Col span={8}><Button block icon={<PrinterOutlined />}>In Bill</Button></Col>
          <Col span={8}><Button block>Lưu tạm</Button></Col>
          <Col span={8}><Button block danger>Hủy</Button></Col>
          
          <Col span={12}>
             <Button 
                type="primary" block size="large" 
                icon={<WalletOutlined />} 
                style={{ height: 60, background: '#fa8c16', fontSize: 16 }}
                onClick={() => handleCheckout('cash')}
             >
                TIỀN MẶT (F9)
             </Button>
          </Col>
          <Col span={12}>
             <Button 
                block size="large" 
                icon={<QrcodeOutlined />} 
                style={{ height: 60, background: '#b5b7ff', fontSize: 16 }}
                onClick={() => handleCheckout('transfer')}
             >
                CK (F10)
             </Button>
          </Col>
       </Row>
    </div>
  );
};
