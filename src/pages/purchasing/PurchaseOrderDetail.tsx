// src/pages/purchasing/PurchaseOrderDetail.tsx
import { SaveOutlined } from "@ant-design/icons";
import { Layout, Form, ConfigProvider, App, Card, Typography, Button } from "antd";
import viVN from "antd/locale/vi_VN";
import { useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";

import POGeneralInfo from "./components/POGeneralInfo";
import POHeaderAction from "./components/POHeaderAction";
import POProductTable from "./components/POProductTable";
import PurchaseCostingSection, { CostingData } from "./components/PurchaseCostingSection";
import { usePurchaseOrderLogic } from "./hooks/usePurchaseOrderLogic";

import CreateInvoiceFromPO from "@/features/finance/components/invoices/CreateInvoiceFromPO";
import InvoiceVerifySection from "@/features/finance/components/invoices/InvoiceVerifySection";
import { searchProductsForPurchase } from "@/features/product/api/productService";
import { FinanceFormModal } from "@/pages/finance/components/FinanceFormModal";
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";
import { printPurchaseOrder } from "@/shared/utils/printTemplates";

const { Content } = Layout;

const scrollToSection = (sectionId: string) => {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const PurchaseOrderDetailContent = () => {
  const logic = usePurchaseOrderLogic();
  const { id } = useParams();

  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const createInvoiceRef = useRef<HTMLDivElement>(null);
  const [costingData, setCostingData] = useState<CostingData | null>(null);

  const handleCostingComplete = useCallback(() => {
    logic.loadOrderDetail(Number(id));
  }, [id, logic.loadOrderDetail]);

  const handleInvoiceComplete = useCallback(() => {
    setShowCreateInvoice(false);
    setInvoiceRefreshKey((k) => k + 1);
    setTimeout(() => scrollToSection("section-invoice"), 100);
  }, []);

  const handlePrintPO = () => {
    printPurchaseOrder({
      code: logic.poCode,
      note: logic.form.getFieldValue("note"),
      supplier_name: logic.supplierInfo?.name,
      supplier_phone: logic.supplierInfo?.phone,
      supplier_address: logic.supplierInfo?.address,
      items: logic.itemsList,
      sub_total: logic.financials.subtotal,
      discount_amount: logic.form.getFieldValue("discount_amount") || 0,
      shipping_fee: logic.form.getFieldValue("shipping_fee") || 0,
      final_amount: logic.financials.final,
    });
  };

  // Hiện full thông tin cho mọi status (trừ DRAFT chưa có gì)
  const showSections = logic.isEditMode && logic.poStatus !== "DRAFT";

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <POHeaderAction
        isEditMode={logic.isEditMode}
        poCode={logic.poCode}
        poStatus={logic.poStatus}
        loading={logic.loading}
        onSave={() => logic.form.submit()}
        onSubmit={logic.confirmOrder}
        onCancelOrder={logic.cancelOrder}
        onPrint={handlePrintPO}
        onRequestPayment={logic.requestPayment}
        onOpenCosting={() => scrollToSection("section-costing")}
        onOpenInvoice={() => {
          setInvoiceRefreshKey((k) => k + 1);
          scrollToSection("section-invoice");
        }}
        onUpdateLogistics={logic.handleUpdateLogistics}
        onRequestShippingPayment={logic.requestShippingPayment}
      />

      <Content style={{ padding: "0 24px", maxWidth: "100%" }}>
        {/* Thông tin chung + Sản phẩm */}
        <div id="section-general">
        <Form form={logic.form} layout="vertical" onFinish={logic.onFinish}>
          <POGeneralInfo
            suppliers={logic.suppliers}
            supplierInfo={logic.supplierInfo}
            onSupplierChange={logic.handleSupplierChange}
            onShippingFeeChange={logic.handleShippingFeeChange}
            shippingPartners={logic.shippingPartners}
            onPartnerChange={logic.handlePartnerChange}
            form={logic.form}
          />
        </Form>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #f0f0f0",
            minHeight: 200,
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid #f0f0f0",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Sản phẩm
          </div>
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #f0f0f0" }}>
            <DebounceProductSelect
              key={logic.searchKey}
              placeholder="Tìm thuốc theo tên, hoạt chất, mã vạch..."
              style={{ width: "100%" }}
              fetcher={searchProductsForPurchase}
              onChange={logic.handleSelectProduct}
            />
          </div>
          <div style={{ padding: "8px 16px" }}>
            <POProductTable
              items={logic.itemsList}
              onItemChange={logic.handleItemChange}
              onRemove={logic.handleRemoveItem}
            />
          </div>
        </div>

        {/* Section: Đối Chiếu Hóa Đơn VAT */}
        {showSections && (
          <div id="section-invoice" style={{ marginTop: 16 }}>
            <Card
              title={
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Đối Chiếu Hóa Đơn VAT
                </Typography.Title>
              }
              styles={{ body: { padding: 16 } }}
            >
              <InvoiceVerifySection
                poId={Number(id)}
                refreshKey={invoiceRefreshKey}
                onRequestPayment={logic.requestPayment}
                onOpenCreateInvoice={() => {
                  setShowCreateInvoice(true);
                  setTimeout(() => createInvoiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }}
              />

              {showCreateInvoice && (
                <div ref={createInvoiceRef} style={{ marginTop: 16, border: "2px solid #52c41a", borderRadius: 8, padding: 16 }}>
                  <CreateInvoiceFromPO
                    poId={Number(id)}
                    poItems={logic.itemsList}
                    supplierId={logic.form.getFieldValue("supplier_id")}
                    onComplete={handleInvoiceComplete}
                  />
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Section: Tính Giá Vốn */}
        {showSections && (
          <div id="section-costing" style={{ marginTop: 24, marginBottom: 24 }}>
            <Card
              title={
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Tính Giá Vốn & Nhập Kho
                </Typography.Title>
              }
              styles={{ body: { padding: 16 } }}
            >
              <PurchaseCostingSection
                poId={Number(id)}
                poItems={logic.itemsList}
                shippingFee={logic.form.getFieldValue("shipping_fee") || 0}
                supplierId={logic.form.getFieldValue("supplier_id")}
                onComplete={handleCostingComplete}
                onCostingDataChange={setCostingData}
              />
            </Card>
          </div>
        )}
      </Content>

      {/* Bottom Sticky: Tổng hợp thanh toán */}
      <div style={{
        position: "sticky",
        bottom: 0,
        zIndex: 50,
        background: "#fff",
        borderTop: "2px solid #e8e8e8",
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 13, color: "#8c8c8c" }}>
          {logic.itemsList.length} sản phẩm · {logic.financials.totalCartons || 0} thùng
        </div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>Tiền hàng</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{(logic.financials.subtotal || 0).toLocaleString()} ₫</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>Phí vận chuyển</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{(logic.financials.shippingFee || 0).toLocaleString()} ₫</div>
          </div>
          <div style={{ textAlign: "right", borderLeft: "2px solid #d9363e", paddingLeft: 16 }}>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>Tổng thanh toán dự kiến</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#d9363e" }}>
              {((logic.financials.subtotal || 0) + (logic.financials.shippingFee || 0)).toLocaleString()} ₫
            </div>
          </div>
          {showSections && costingData && (
            <>
              <div style={{ textAlign: "right", borderLeft: "2px solid #52c41a", paddingLeft: 16 }}>
                <div style={{ fontSize: 11, color: "#8c8c8c" }}>Tổng giá trị nhập kho (Dự kiến)</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#52c41a" }}>
                  {(costingData.costingTotal || 0).toLocaleString()} ₫
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={costingData.handleSubmit}
                loading={costingData.loading}
                style={{ minWidth: 200, height: 48, fontSize: 15, background: "#52c41a", borderColor: "#52c41a" }}
              >
                Chốt Giá Vốn & Công Nợ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <FinanceFormModal
        open={logic.paymentModalOpen}
        onCancel={() => logic.setPaymentModalOpen(false)}
        initialFlow="out"
        initialValues={logic.paymentInitialValues}
      />
    </Layout>
  );
};

const PurchaseOrderDetail = () => (
  <ConfigProvider locale={viVN}>
    <App>
      <PurchaseOrderDetailContent />
    </App>
  </ConfigProvider>
);

export default PurchaseOrderDetail;
