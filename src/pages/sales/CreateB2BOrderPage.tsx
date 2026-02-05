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
import { useState, useEffect } from "react"; 
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient"; 

import { salesService } from "@/features/sales/api/salesService";
import { PaymentSummary } from "@/features/sales/components/Footer/PaymentSummary";
import { VoucherSelector } from "@/features/sales/components/Footer/VoucherSelector";
import { CustomerInfoCard } from "@/features/sales/components/Header/CustomerInfoCard";
import { CustomerSelector } from "@/features/sales/components/Header/CustomerSelector";
import { ShippingForm } from "@/features/sales/components/Header/ShippingForm";
import { SalesOrderTable } from "@/features/sales/components/ProductGrid/SalesOrderTable";
import { useCreateOrderB2B } from "@/features/sales/hooks/useCreateOrderB2B";
import { ActionButtons } from "@/features/sales/components/Footer/ActionButtons";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates"; 
import { printHTML } from "@/shared/utils/printUtils"; 

// [NEW] Picking List Print
import { usePickingListPrint } from "@/features/sales/hooks/usePickingListPrint";
import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate";

const { Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

const CreateB2BOrderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const isEditMode = !!id;    
  const [loading, setLoading] = useState(false);

  // [NEW] Hook Picking Print
  const { printByData: printPicking, printData: pickingData } = usePickingListPrint();

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
    setItems,
    setManualDiscount,
    reset,
    validateOrder,
  } = useCreateOrderB2B();

  // Load Edit Data
  useEffect(() => {
    const fetchOrderForEdit = async () => {
        if (!id) return; 

        try {
            setLoading(true);

            // 1. QUERY AN TOÀN (Bỏ !inner, dùng maybeSingle)
            const { data: orderData, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:customers(*), 
                    items:order_items(
                        *,
                        product:products(
                            name, 
                            sku, 
                            image_url,
                            active_ingredient
                        )
                    )
                `)
                .eq('id', id)
                .maybeSingle(); 

            if (error) throw error;
            
            if (!orderData) {
                message.error("Không tìm thấy đơn hàng (hoặc bạn không có quyền xem).");
                navigate("/b2b/orders");
                return;
            }

            // 2. HYDRATION KHÁCH HÀNG
            if (orderData.customer) {
                const mappedCustomer = {
                    ...orderData.customer,
                    shipping_address: orderData.delivery_address || orderData.customer.address || "", 
                    current_debt: orderData.customer.current_debt || 0
                };
                setCustomer(mappedCustomer);
            } else {
                message.warning("Đơn hàng này không tìm thấy thông tin khách hàng gốc.");
            }
            
            // 3. HYDRATION SẢN PHẨM
            const safeItems = orderData.items || [];
            const mappedItems = safeItems.map((item: any) => {
                const productInfo = item.product || {};
                
                return {
                    id: item.product_id,
                    key: `${item.product_id}_${Date.now()}_${Math.random()}`,
                    
                    name: productInfo.name || item.product_name || "Sản phẩm (Mất info)", 
                    sku: productInfo.sku || item.sku || "---",
                    image_url: productInfo.image_url || null,
                    
                    price_wholesale: item.unit_price,
                    quantity: item.quantity,
                    wholesale_unit: item.uom || "Cái", 
                    
                    discount: item.discount || 0,
                    stock_quantity: 9999, 
                    total: (item.quantity * item.unit_price) - (item.discount || 0),
                    
                    active_ingredient: productInfo.active_ingredient
                };
            });
            
            if(mappedItems.length > 0) {
                 setItems(mappedItems);
            }

            // 4. HYDRATION TÀI CHÍNH
            if (orderData.discount_amount > 0) setManualDiscount(orderData.discount_amount);
            setShippingFee(orderData.shipping_fee || 0);
            setNote(orderData.note || "");
            
            if (orderData.delivery_method) setDeliveryMethod(orderData.delivery_method);
            if (orderData.shipping_partner_id) selectShippingPartner(orderData.shipping_partner_id);
            
        } catch (err: any) {
            console.error("Hydration Error:", err);
            message.error("Lỗi tải đơn hàng: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    fetchOrderForEdit();
  }, [id]);

  const handleSubmit = async (status: "DRAFT" | "QUOTE" | "CONFIRMED") => {
    if (!validateOrder()) return;

    setLoading(true);
    try {
      if (isEditMode && id) {
          await salesService.updateOrder({
              p_order_id: id,
              p_customer_id: customer!.id,
              p_delivery_address: customer!.shipping_address || "",
              p_delivery_time: estimatedDeliveryText,
              p_note: note,
              p_discount_amount: financials.discountAmount,
              p_shipping_fee: shippingFee,
              p_status: status,
              p_items: items.map(i => ({
                  product_id: i.id,
                  quantity: i.quantity,
                  uom: i.wholesale_unit, 
                  unit_price: i.price_wholesale,
                  discount: i.discount || 0,
                  is_gift: false,
                  note: "" 
              }))
          });
          message.success("Cập nhật đơn hàng thành công!");
          navigate("/b2b/orders");
      } else {
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
            p_warehouse_id: 1, 
            p_order_type: 'B2B',
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
      }
    } catch (e: any) {
      message.error(e.message || "Lỗi tạo đơn");
    } finally {
      setLoading(false);
    }
  };

  // Print Preview Logic (Quote/Invoice)
  const handlePrintPreview = () => {
    if (!customer) return message.warning("Chưa chọn khách hàng");
    if (items.length === 0) return message.warning("Chưa có sản phẩm");

    const mockOrder = {
        code: isEditMode ? "Đang cập nhật..." : "BÁO GIÁ", // Có thể lấy mã thật nếu có
        created_at: new Date().toISOString(),
        customer_name: customer.name,
        customer_phone: customer.phone,
        delivery_address: customer.shipping_address,
        note: note,
        items: items.map(i => ({
            product_name: i.name,
            uom: i.wholesale_unit,
            quantity: i.quantity,
            unit_price: i.price_wholesale,
            total_line: (i.quantity * i.price_wholesale) - (i.discount || 0)
        })),
        total_amount: financials.subTotal,
        discount_amount: financials.discountAmount,
        shipping_fee: shippingFee,
        final_amount: financials.finalTotal,
        old_debt: financials.oldDebt 
    };

    const html = generateB2BOrderHTML(mockOrder);
    printHTML(html);
  };

  // [NEW] Handle Print Picking List
  const handlePrintPickingPreview = () => {
    if (!customer) return message.warning("Chưa chọn khách hàng");
    if (items.length === 0) return message.warning("Chưa có sản phẩm");

    const orderInfo = {
        id: id || "temp-id", // [NEW]
        code: isEditMode ? "---" : "Tạm tính", 
        customer_name: customer.name,
        shipping_partner: "---", 
        shipping_phone: customer.phone,
        delivery_address: customer.shipping_address || "", // [NEW]
        note: note || "", // [NEW]
        status: "DRAFT", // [NEW]
        cutoff_time: "---",
        package_count: 0
    };

    const pickItems = items.map(i => ({
        product_id: i.id,
        sku: i.sku,
        product_name: i.name,
        unit: i.wholesale_unit,
        quantity_ordered: i.quantity,
        shelf_location: "",
        barcode: "", // [NEW]
        quantity_picked: 0, // [NEW]
        image_url: i.image_url || "" // [NEW]
    }));

    printPicking(orderInfo, pickItems);
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
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
            {isEditMode ? "Cập nhật Đơn Bán Buôn (B2B)" : "Tạo Đơn Bán Buôn (B2B)"}
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
        <Row gutter={24}>
          <Col span={16}>
            <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 0 }}>
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

          <Col span={8}>
            <div style={{ position: "sticky", top: 80 }}>
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
                onPrint={handlePrintPreview}
                onPrintPicking={handlePrintPickingPreview} // [NEW] Pass function
              />
            </div>
          </Col>
        </Row>
      </Content>
      
      {/* [NEW] HIDDEN PRINT TEMPLATE */}
      {pickingData && (
        <div style={{ display: 'none' }}>
            <PickingListTemplate 
                orderInfo={pickingData.orderInfo} 
                items={pickingData.items} 
            />
        </div>
      )}
    </Layout>
  );
};

export default CreateB2BOrderPage;
