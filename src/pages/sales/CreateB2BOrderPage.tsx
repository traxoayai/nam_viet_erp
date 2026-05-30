// src/pages/sales/CreateB2BOrderPage.tsx
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Layout,
  Row,
  Col,
  Typography,
  Card,
  Select,
  message,
  Alert,
} from "antd";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { CustomerB2B, CartItem } from "@/features/sales/types/b2b_sales";

import { financeService } from "@/features/finance/api/financeService";
import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate";
import { salesService } from "@/features/sales/api/salesService";
import { ActionButtons } from "@/features/sales/components/Footer/ActionButtons";
import { PaymentSummary } from "@/features/sales/components/Footer/PaymentSummary";
import { VoucherSelector } from "@/features/sales/components/Footer/VoucherSelector";
import { CustomerInfoCard } from "@/features/sales/components/Header/CustomerInfoCard";
import { CustomerSelector } from "@/features/sales/components/Header/CustomerSelector";
import { ShippingForm } from "@/features/sales/components/Header/ShippingForm";
import { SalesOrderTable } from "@/features/sales/components/ProductGrid/SalesOrderTable";
import { useCreateOrderB2B } from "@/features/sales/hooks/useCreateOrderB2B";
import { usePickingListPrint } from "@/features/sales/hooks/usePickingListPrint";
import { DEFAULT_WAREHOUSE_ID } from "@/shared/constants/defaults";
import { useSubmitLock } from "@/shared/hooks/useSubmitLock";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
import { generateB2BOrderHTML } from "@/shared/utils/printTemplates";
import { printHTML } from "@/shared/utils/printUtils";

// [NEW] Picking List Print

const { Content } = Layout;
const { Title } = Typography;

const CreateB2BOrderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { isLocked: submitLoading, withLock } = useSubmitLock();
  const [editLoading, setLoading] = useState(false);
  const loading = submitLoading || editLoading;
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "credit" | "bank_transfer"
  >("credit");

  // [NEW] Hook Picking Print
  const { printByData: printPicking, printData: pickingData } =
    usePickingListPrint();

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

  // [NEW] Fetch full B2B customer info via Edge Function
  const handleCustomerSelect = async (partialCustomer: CustomerB2B) => {
    try {
      const hide = message.loading("Đang tải thông tin chi tiết khách hàng...", 0);
      const { data, error } = await supabase.functions.invoke("get-info-customer-b2b", {
        body: { id: partialCustomer.id }
      });
      hide();
      
      if (error) throw error;
      const res = data.data;

      const mappedCustomer: CustomerB2B = {
        ...partialCustomer,
        id: res.customer.id,
        name: res.customer.name,
        tax_code: res.customer.tax_code,
        shipping_address: res.customer.shipping_address,
        debt_limit: res.customer.debt_limit,
        current_debt: res.debt.actual_current_debt,
        contacts: res.contacts || [],
      };
      
      setCustomer(mappedCustomer);
    } catch (err) {
      console.error(err);
      message.error("Lỗi lấy chi tiết thông tin khách hàng. Sử dụng thông tin cơ bản.");
      setCustomer(partialCustomer);
    }
  };

  // Load Edit Data
  useEffect(() => {
    const fetchOrderForEdit = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // 1. QUERY AN TOÀN (Bỏ !inner, dùng maybeSingle)
        const { data: orderData, error } = await supabase
          .from("orders")
          .select(
            `
                    *,
                    customer_b2b:customers_b2b(*), 
                    customer_b2c:customers(*), 
                    items:order_items(
                        *,
                        product:products(
                            name, 
                            sku, 
                            image_url,
                            active_ingredient
                        )
                    )
                `
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        if (!orderData) {
          message.error(
            "Không tìm thấy đơn hàng (hoặc bạn không có quyền xem)."
          );
          navigate("/b2b/orders");
          return;
        }

        // 2. HYDRATION KHÁCH HÀNG
        const customerData = orderData.customer_b2b || orderData.customer_b2c;
        if (customerData) {
          // [NEW] Không dùng customerData.current_debt cũ nữa.
          const actualDebt = await financeService.getB2BDebt(customerData.id);
          const cd = customerData as Record<string, unknown>;
          const mappedCustomer: CustomerB2B = {
            id: customerData.id,
            name: (cd.name as string) || "",
            tax_code: (cd.tax_code as string) || "",
            vat_address: (cd.vat_address as string) || "",
            shipping_address:
              (orderData.delivery_address as string) ||
              (cd.shipping_address as string) ||
              (cd.address as string) ||
              "",
            phone: (cd.phone as string) || "",
            debt_limit: (cd.debt_limit as number) || 0,
            current_debt: actualDebt,
            loyalty_points: (cd.loyalty_points as number) || 0,
            is_bad_debt: (cd.is_bad_debt as boolean) || false,
            contacts: [],
          };
          setCustomer(mappedCustomer);
        } else {
          message.warning(
            "Đơn hàng này không tìm thấy thông tin khách hàng gốc."
          );
        }

        // 3. HYDRATION SẢN PHẨM
        const safeItems = orderData.items || [];

        // Fetch stock thật cho tất cả sản phẩm trong đơn
        const productIds = safeItems
          .map((i: Record<string, unknown>) => i.product_id as number)
          .filter(Boolean);
        const stockMap = new Map<number, number>();
        if (productIds.length > 0) {
          try {
            const { data: stockData } = await safeRpc(
              "get_products_stock_status",
              {
                p_product_ids: productIds,
              }
            );
            for (const s of (stockData || []) as Array<{
              product_id: number;
              total_quantity: number;
            }>) {
              stockMap.set(s.product_id, s.total_quantity);
            }
          } catch (stockErr: unknown) {
            const msg =
              stockErr instanceof Error
                ? stockErr.message
                : "Lỗi không xác định";
            message.error(`Không thể tải tồn kho sản phẩm: ${msg}`);
            return;
          }
        }

        const mappedItems: CartItem[] = safeItems.map(
          (item: Record<string, unknown>) => {
            const productInfo = (item.product || {}) as Record<string, unknown>;
            const pid = item.product_id as number;

            return {
              id: pid,
              key: `${pid}_${Date.now()}_${Math.random()}`,

              name:
                (productInfo.name as string) ||
                (item.product_name as string) ||
                "Sản phẩm (Mất info)",
              sku: (productInfo.sku as string) || (item.sku as string) || "---",
              image_url: (productInfo.image_url as string) || null,

              price_wholesale: item.unit_price as number,
              quantity: item.quantity as number,
              wholesale_unit: (item.uom as string) || "",

              discount: (item.discount as number) || 0,
              stock_quantity: stockMap.get(pid) ?? 0,
              total:
                (item.quantity as number) * (item.unit_price as number) -
                ((item.discount as number) || 0),

              shelf_location: (productInfo.shelf_location as string) || "",
              lot_number: (productInfo.lot_number as string) || null,
              expiry_date: (productInfo.expiry_date as string) || null,
              items_per_carton: (productInfo.items_per_carton as number) || 1,
            };
          }
        );

        if (mappedItems.length > 0) {
          setItems(mappedItems);
        }

        // 4. HYDRATION TÀI CHÍNH
        if ((orderData.discount_amount || 0) > 0)
          setManualDiscount(orderData.discount_amount || 0);
        setShippingFee(orderData.shipping_fee || 0);
        setNote(orderData.note || "");

        if (orderData.delivery_method)
          setDeliveryMethod(
            orderData.delivery_method as "internal" | "app" | "coach"
          );
        if (orderData.shipping_partner_id)
          selectShippingPartner(orderData.shipping_partner_id);
      } catch (err: unknown) {
        console.error("Hydration Error:", err);
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        message.error("Lỗi tải đơn hàng: " + msg);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = (status: "DRAFT" | "QUOTE" | "CONFIRMED") =>
    withLock(async () => {
      // 1. Validate cơ bản (Form)
      if (!validateOrder()) return;

      // [2026-04-25] Verify giá server-side — bỏ qua FE state manipulation.
      // Tương tự Portal app/api/orders/route.ts:151-182.
      let verifiedItems = items;
      if (customer && items.length > 0) {
        const productIds = items.map((i) => i.id);
        type PriceRow = { product_id: number; customer_price: number };
        let pricesData: PriceRow[] | null = null;
        try {
          const result = await safeRpc("get_customer_product_prices", {
            p_customer_b2b_id: customer.id,
            p_product_ids: productIds,
          });
          pricesData = result.data as unknown as PriceRow[] | null;
        } catch {
          message.error("Không thể xác thực giá sản phẩm từ server");
          return;
        }
        const priceMap = new Map<number, number>(
          (pricesData ?? []).map((p) => [p.product_id, p.customer_price])
        );
        const mapped = items.map((it) => {
          const serverPrice = priceMap.get(it.id);
          if (serverPrice === undefined) return null;
          return { ...it, price_wholesale: serverPrice };
        });
        if (mapped.includes(null)) {
          message.error("Một số sản phẩm không còn hợp lệ");
          return;
        }
        verifiedItems = mapped as typeof items;
      }

      // [2026-04-25] Validate tồn kho qua RPC chung `validate_stock_for_order`
      // Backend (create_sales_order) đã tự động validate khi status='CONFIRMED'.
      // Không cần validate ở FE để tránh bug.

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
            p_items: verifiedItems.map((i) => ({
              product_id: i.id,
              quantity: i.quantity,
              uom: i.wholesale_unit,
              unit_price: i.price_wholesale,
              discount: i.discount || 0,
              is_gift: false,
              note: "",
            })),
          });
          message.success("Cập nhật đơn hàng thành công!");
          navigate("/b2b/orders");
        } else {
          await salesService.createOrder({
            p_customer_id: customer!.id,
            p_delivery_address: customer!.shipping_address,
            p_note: note,
            p_discount_amount: financials.discountAmount,
            p_shipping_fee: shippingFee,
            p_status: status,
            p_delivery_method: deliveryMethod,
            p_shipping_partner_id:
              deliveryMethod === "internal" ? null : shippingPartnerId,
            // Backend (create_sales_order) tự resolve kho B2B qua get_b2b_warehouse_id()
            // khi order_type='B2B'. FE chỉ gửi placeholder nhất quán.
            p_warehouse_id: DEFAULT_WAREHOUSE_ID,
            p_payment_method: paymentMethod,
            p_order_type: "B2B",
            p_items: verifiedItems.map((i) => ({
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Lỗi tạo đơn";
        message.error(msg);
      }
    });

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
      items: items.map((i) => ({
        product_name: i.name,
        uom: i.wholesale_unit,
        quantity: i.quantity,
        unit_price: i.price_wholesale,
        total_line: i.quantity * i.price_wholesale - (i.discount || 0),
        shelf_location: i.shelf_location || "",
        batch_no: i.lot_number || "",
        expiry_date: i.expiry_date || "",
      })),
      total_amount: financials.subTotal,
      discount_amount: financials.discountAmount,
      shipping_fee: shippingFee,
      final_amount: financials.finalTotal,
      old_debt: financials.oldDebt,
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
      package_count: 0,
    };

    const pickItems = items.map((i) => ({
      product_id: i.id,
      sku: i.sku,
      product_name: i.name,
      unit: i.wholesale_unit,
      quantity_ordered: i.quantity,
      shelf_location: i.shelf_location || "",
      barcode: "", // [NEW]
      quantity_picked: 0, // [NEW]
      image_url: i.image_url || "", // [NEW]
    }));

    printPicking(orderInfo, pickItems);
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {/* --- KHU VỰC HEADER --- */}
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          display: "flex", // [NEW] Flex layout
          justifyContent: "space-between", // [NEW] Đẩy 2 bên
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <ArrowLeftOutlined
            style={{ fontSize: 18, marginRight: 12, cursor: "pointer" }}
            onClick={() => navigate(-1)}
          />
          <Title level={4} style={{ margin: 0 }}>
            {isEditMode
              ? "Cập nhật Đơn Bán Buôn (B2B)"
              : "Tạo Đơn Bán Buôn (B2B)"}
          </Title>
        </div>

        {/* [NEW] ĐƯA NÚT BẤM LÊN ĐÂY */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <ActionButtons
            loading={loading}
            isOverLimit={financials.isOverLimit}
            onSubmit={handleSubmit}
            onPrint={handlePrintPreview}
            onPrintPicking={handlePrintPickingPreview}
            style={{ marginTop: 0 }} // Reset margin
          />
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
            {/* KHỐI A: THÔNG TIN KHÁCH HÀNG */}
            <div style={{ marginBottom: 16 }}>
              {!customer ? (
                <Card style={{ width: "100%", borderTop: "3px solid #1890ff" }} bodyStyle={{ padding: 20 }}>
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text strong style={{ fontSize: 16 }}>Khách hàng</Typography.Text>
                  </div>
                  <CustomerSelector onSelect={handleCustomerSelect} />
                </Card>
              ) : (
                <CustomerInfoCard
                  customer={customer}
                  onClear={() => setCustomer(null)}
                  currentDebt={customer.current_debt}
                  newDebt={financials.finalTotal}
                  isOverLimit={financials.isOverLimit}
                  note={note}
                  setNote={setNote}
                />
              )}
            </div>

            {/* KHỐI B: THÔNG TIN GIAO HÀNG */}
            <div style={{ marginBottom: 16 }}>
              <Card style={{ width: "100%", borderTop: "3px solid #52c41a" }} bodyStyle={{ padding: "16px" }}>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>Giao hàng</Typography.Text>
                </div>
                <ShippingForm
                  deliveryMethod={deliveryMethod}
                  setDeliveryMethod={setDeliveryMethod}
                  shippingPartnerId={shippingPartnerId}
                  setShippingPartner={selectShippingPartner}
                  estimatedDeliveryText={estimatedDeliveryText}
                />
              </Card>
            </div>

            {/* KHỐI C: SẢN PHẨM */}
            <SalesOrderTable
              items={items}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />
          </Col>

          <Col span={8}>
            <div style={{ position: "sticky", top: 80 }}>
              {/* [NEW] HIỂN THỊ ALERT Ở ĐÂY (Thay vì trong nút bấm) */}
              {financials.isOverLimit ? (
                <Alert
                  message="Cảnh báo: Vượt quá hạn mức tín dụng!"
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              ) : null}

              <Card
                title="Thanh toán"
                size="small"
                style={{ marginBottom: 16 }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text
                    strong
                    style={{ display: "block", marginBottom: 4 }}
                  >
                    Phương thức thanh toán
                  </Typography.Text>
                  <Select
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    style={{ width: "100%" }}
                    options={[
                      { value: "credit", label: "Công nợ" },
                      { value: "cash", label: "Tiền mặt" },
                      { value: "bank_transfer", label: "Chuyển khoản" },
                    ]}
                  />
                </div>
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

              {/* [REMOVED] Đã xóa ActionButtons ở dưới cùng này */}
            </div>
          </Col>
        </Row>
      </Content>

      {/* [NEW] HIDDEN PRINT TEMPLATE */}
      {pickingData ? (
        <div style={{ display: "none" }}>
          <PickingListTemplate
            orderInfo={pickingData.orderInfo}
            items={pickingData.items}
          />
        </div>
      ) : null}
    </Layout>
  );
};

export default CreateB2BOrderPage;
