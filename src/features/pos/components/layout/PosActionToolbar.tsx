//src/features/pos/components/layout/PosActionToolbar.tsx
import {
  WalletOutlined,
  QrcodeOutlined,
  PrinterOutlined,
  FileProtectOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import { Row, Col, Button, message, notification, Card } from "antd";
import { useState } from "react";

import { posService } from "../../api/posService";
import { usePosCartStore } from "../../stores/usePosCartStore";
import { PosCreateOrderPayload } from "../../types/pos.types";
import { VatInvoiceModal } from "../modals/VatInvoiceModal";

import { printPosBill, printInstruction } from "@/shared/utils/printTemplates";

export const PosActionToolbar = () => {
  const { getTotals, clearCart, warehouseId, getCurrentOrder } =
    usePosCartStore();
  const currentOrder = getCurrentOrder();
  const items = currentOrder?.items || [];
  const customer = currentOrder?.customer;

  const [showVatModal, setShowVatModal] = useState(false);

  // --- LOGIC BÁN HÀNG ---
  const handleCheckout = async (method: "cash" | "transfer" | "debt") => {
    if (items.length === 0) return message.warning("Giỏ hàng trống!");
    if (!warehouseId) return message.error("Chưa chọn kho xuất hàng!");

    const totals = getTotals();

    const payload: PosCreateOrderPayload = {
      p_order_type: "POS",
      p_customer_b2c_id: customer?.id || null,
      p_customer_b2b_id: null,
      p_payment_method: method,
      p_items: items.map((i) => ({
        product_id: i.id,
        quantity: i.qty,
        uom: i.unit,
        unit_price: i.price,
        discount: 0,
      })),
      p_shipping_fee: 0,
      p_discount_amount: totals.discountVal,
      p_status: "DELIVERED",
      p_warehouse_id: warehouseId,
    };

    try {
      message.loading({ content: "Đang xử lý...", key: "pos_checkout" });
      await posService.createOrder(payload);
      message.success({
        content: "Thanh toán thành công!",
        key: "pos_checkout",
      });
      clearCart();
    } catch (err: any) {
      const errMsg = err.message || "Lỗi không xác định";
      if (
        errMsg.toLowerCase().includes("không đủ tồn kho") ||
        errMsg.toLowerCase().includes("không đủ vật tư")
      ) {
        notification.error({
          message: "Lỗi Tồn Kho / Vật Tư",
          description: errMsg,
          duration: 6,
        });
      } else {
        message.error({ content: "Lỗi: " + errMsg, key: "pos_checkout" });
      }
    }
  };

  const handlePrintBill = () => {
    if (items.length === 0) return message.warning("Giỏ hàng trống");
    const totals = getTotals();
    const mockOrder = {
      code: "PREVIEW",
      sub_total: totals.subTotal,
      discount_amount: totals.discountVal,
      final_amount: totals.grandTotal,
      customer_name: customer?.name || customer?.buyer_name || "",
      customer_phone: customer?.phone || "",
      loyalty_points: customer?.loyalty_points,
      items: items.map((i) => ({
        product_name: i.name,
        uom: i.unit,
        quantity: i.qty,
        unit_price: i.price,
      })),
    };
    printPosBill(mockOrder);
  };

  const handlePrintInstructions = () => {
    if (items.length === 0) return message.warning("Giỏ hàng trống");
    items.forEach((item) => {
      if (item.dosage) printInstruction(item.name, item.dosage);
    });
    message.success("Đang gửi lệnh in HDSD...");
  };

  return (
    <Card 
      bodyStyle={{ padding: 12 }} 
      style={{ 
        marginTop: 16, 
        borderRadius: 12, 
        border: 'none', 
        backgroundColor: '#f8fbfc' 
      }}
    >
      <VatInvoiceModal
        visible={showVatModal}
        onCancel={() => setShowVatModal(false)}
        orderItems={items}
        customer={customer}
      />

      <Row gutter={[12, 12]}>
        <Col span={8}>
          <Button 
            block 
            icon={<PrinterOutlined />} 
            onClick={handlePrintBill}
            size="large"
            style={{ borderRadius: 8, height: 48, fontWeight: 500 }}
          >
            Bill
          </Button>
        </Col>
        <Col span={8}>
          <Button
            block
            icon={<ReadOutlined />}
            onClick={handlePrintInstructions}
            size="large"
            style={{ borderRadius: 8, height: 48, fontWeight: 500 }}
          >
            HDSD
          </Button>
        </Col>

        <Col span={8}>
          <Button
            block
            icon={<FileProtectOutlined />}
            onClick={() => setShowVatModal(true)}
            size="large"
            style={{ borderRadius: 8, height: 48, fontWeight: 500 }}
          >
            VAT
          </Button>
        </Col>

        {/* Hàng 2: Thanh toán chính */}
        <Col span={12}>
          <Button
            type="primary"
            block
            size="large"
            icon={<WalletOutlined style={{ fontSize: 24 }} />}
            style={{ 
              height: 72, 
              background: "linear-gradient(135deg, #fa8c16 0%, #ffbb96 100%)", 
              fontSize: 18, 
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 4px 12px rgba(250, 140, 22, 0.3)',
              borderRadius: 12
            }}
            onClick={() => handleCheckout("cash")}
          >
            TIỀN MẶT (F9)
          </Button>
        </Col>
        <Col span={12}>
          <Button
            block
            size="large"
            icon={<QrcodeOutlined style={{ fontSize: 24 }} />}
            style={{ 
              height: 72, 
              background: "linear-gradient(135deg, #1890ff 0%, #91d5ff 100%)", 
              color: '#fff',
              fontSize: 18, 
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              borderRadius: 12
            }}
            onClick={() => handleCheckout("transfer")}
          >
            CK (F10)
          </Button>
        </Col>
      </Row>
    </Card>
  );
};

