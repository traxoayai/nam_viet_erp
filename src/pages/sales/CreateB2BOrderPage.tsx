// src/pages/sales/CreateB2BOrderPage.tsx
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Layout,
  Row,
  Col,
  Typography,
  Card,
  Input,
  message,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { salesService } from "@/features/sales/api/salesService";
import { PaymentSummary } from "@/features/sales/components/Footer/PaymentSummary";
import { VoucherSelector } from "@/features/sales/components/Footer/VoucherSelector";
import { CustomerInfoCard } from "@/features/sales/components/Header/CustomerInfoCard";
import { CustomerSelector } from "@/features/sales/components/Header/CustomerSelector";
import { ShippingForm } from "@/features/sales/components/Header/ShippingForm";
import { SalesOrderTable } from "@/features/sales/components/ProductGrid/SalesOrderTable";
import { useCreateOrderB2B } from "@/features/sales/hooks/useCreateOrderB2B";
import { ActionButtons } from "@/features/sales/components/Footer/ActionButtons";
//import { ProductSearchB2B } from "@/components/search/ProductSearchB2B";

const { Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

const CreateB2BOrderPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // SỬA LỖI: Destructure thêm biến shippingFee từ hook
  const {
    customer,
    items,
    deliveryMethod,
    shippingPartnerId,
    note,
    selectedVoucher,
    financials,
    estimatedDeliveryText,
    shippingFee,
    setCustomer,
    addItem,
    updateItem,
    removeItem,
    setDeliveryMethod,
    selectShippingPartner,
    setNote,
    setVoucher,
    setShippingFee,
    reset,
    validateOrder,
  } = useCreateOrderB2B();

  const handleSubmit = async (status: "DRAFT" | "QUOTE" | "CONFIRMED") => {
    if (!validateOrder()) return;

    setLoading(true);
    try {
      await salesService.createOrder({
        p_customer_id: customer!.id,
        p_delivery_address: customer!.shipping_address,
        p_delivery_time: estimatedDeliveryText,
        p_note: note,
        p_discount_amount: financials.discountAmount,
        p_shipping_fee: shippingFee,
        p_status: status,
        p_delivery_method: deliveryMethod,
        p_shipping_partner_id:
          deliveryMethod === "internal" ? null : shippingPartnerId,
        p_warehouse_id: 1, // [NEW] B2B tạm thời lấy kho ID = 1
        p_items: items.map((i) => ({
          product_id: i.id,
          quantity: i.quantity,
          uom: i.wholesale_unit,
          unit_price: i.price_wholesale,
          discount: i.discount,
          is_gift: false,
        })),
      });

      message.success(
        status === "QUOTE"
          ? "Đã tạo báo giá thành công"
          : "Tạo đơn hàng thành công"
      );
      reset();
      navigate("/b2b/orders");
    } catch (e: any) {
      message.error(e.message || "Lỗi tạo đơn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {/* Header giữ nguyên */}
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowLeftOutlined
            style={{ fontSize: 18, marginRight: 12, cursor: "pointer" }}
            onClick={() => navigate(-1)}
          />
          <Title level={4} style={{ margin: 0 }}>
            Tạo Đơn Bán Buôn (B2B)
          </Title>
        </div>
      </div>

      <Content
        style={{
          padding: "24px",
          maxWidth: 1400,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {" "}
        {/* Tăng maxWidth để thoáng hơn */}
        <Row gutter={24}>
          {/* CỘT TRÁI: ĐIỀU CHỈNH TỪ 18 -> 16 */}
          <Col span={16}>
            <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 0 }}>
              {/* ... [Keep Customer Logic] ... */}
              {!customer ? (
                <div style={{ padding: 20 }}>
                  <CustomerSelector onSelect={setCustomer} />
                </div>
              ) : (
                <>
                  <CustomerInfoCard
                    customer={customer}
                    onClear={() => setCustomer(null)}
                    currentDebt={customer.current_debt}
                    newDebt={financials.finalTotal}
                    isOverLimit={financials.isOverLimit}
                  />
                  <div style={{ padding: "0 20px 20px 20px" }}>
                    <ShippingForm
                      deliveryMethod={deliveryMethod}
                      setDeliveryMethod={setDeliveryMethod}
                      shippingPartnerId={shippingPartnerId}
                      setShippingPartner={selectShippingPartner}
                      estimatedDeliveryText={estimatedDeliveryText}
                    />
                  </div>
                </>
              )}
            </Card>

            {/* [NEW] CHÈN THANH TÌM KIẾM VÀO ĐÂY */}
            {/* <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 12 }}>
                <ProductSearchB2B 
                    onSelect={addItem} 
                    warehouseId={1} // Hardcode tạm hoặc lấy từ state
                />
            </Card> */}

            <SalesOrderTable
              items={items}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />

            <Card size="small" style={{ marginTop: 16 }}>
              <TextArea
                placeholder="Ghi chú đơn hàng (VD: Giao giờ hành chính, gọi trước khi giao)..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </Card>
          </Col>

          {/* CỘT PHẢI: ĐIỀU CHỈNH TỪ 6 -> 8 */}
          <Col span={8}>
            <div style={{ position: "sticky", top: 80 }}>
              {/* ... (Phần Thanh toán giữ nguyên) */}
              <Card
                title="Thanh toán"
                size="small"
                style={{ marginBottom: 16 }}
              >
                <VoucherSelector
                  customerId={customer?.id}
                  orderTotal={financials.subTotal}
                  selectedVoucher={selectedVoucher}
                  onSelect={setVoucher}
                />
                <PaymentSummary
                  subTotal={financials.subTotal}
                  discount={financials.discountAmount}
                  shippingFee={shippingFee}
                  setShippingFee={setShippingFee}
                  finalTotal={financials.finalTotal}
                  oldDebt={financials.oldDebt}
                  totalPayable={financials.totalPayable}
                />
              </Card>

              <ActionButtons
                loading={loading}
                isOverLimit={financials.isOverLimit}
                onSubmit={handleSubmit}
              />
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default CreateB2BOrderPage;
