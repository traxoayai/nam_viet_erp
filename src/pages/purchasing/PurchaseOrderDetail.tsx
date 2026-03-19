// src/pages/purchasing/PurchaseOrderDetail.tsx
import { Layout, Form, Row, Col, ConfigProvider, App } from "antd";
import viVN from "antd/locale/vi_VN";
import { useNavigate, useParams } from "react-router-dom";

import { CostAllocationModal } from "./components/CostAllocationModal";
import POGeneralInfo from "./components/POGeneralInfo";
import POHeaderAction from "./components/POHeaderAction";
import POPaymentSummary from "./components/POPaymentSummary";
import POProductTable from "./components/POProductTable";
import { usePurchaseOrderLogic } from "./hooks/usePurchaseOrderLogic";
import { printPurchaseOrder } from "@/shared/utils/printTemplates";

import { searchProductsForPurchase } from "@/features/product/api/productService";
import { FinanceFormModal } from "@/pages/finance/components/FinanceFormModal";
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";

const { Content } = Layout;

const PurchaseOrderDetailContent = () => {
  const logic = usePurchaseOrderLogic();
  const navigate = useNavigate();
  const { id } = useParams();
  const handlePrintPO = () => {
    // Tổng hợp dữ liệu từ logic để đưa vào template in
    const poDataForPrint = {
      code: logic.poCode,
      note: logic.form.getFieldValue("note"),
      supplier_name: logic.supplierInfo?.name,
      supplier_phone: logic.supplierInfo?.phone,
      supplier_address: logic.supplierInfo?.address,
      items: logic.itemsList,
      
      // [FIX ERROR TS2339 & TS2551]: Lấy đúng key từ financials và form
      sub_total: logic.financials.subtotal, 
      discount_amount: logic.form.getFieldValue("discount_amount") || 0,
      shipping_fee: logic.form.getFieldValue("shipping_fee") || 0,
      final_amount: logic.financials.final,
    };
    
    printPurchaseOrder(poDataForPrint);
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <Form form={logic.form} layout="vertical" onFinish={logic.onFinish}>
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
          onCalculateInbound={() => {
            navigate(`/purchase-orders/costing/${id}`);
          }}
        />

        {/* [FIXED] Mở rộng max-width từ 1400px thành 100% full màn hình */}
        <Content
          style={{
            maxWidth: "100%", 
            margin: "0 auto",
            width: "100%",
            padding: "0 24px", // Tăng lề 2 bên lên một chút cho đẹp
          }}
        >
          <Row gutter={[24, 24]}>
            {/* [FIXED] Tăng tỷ lệ cột Trái: lg={18} (màn thường), xl={19} (màn siêu to) */}
            <Col xs={24} lg={18} xl={19}>
              <POGeneralInfo
                suppliers={logic.suppliers}
                supplierInfo={logic.supplierInfo}
                onSupplierChange={logic.handleSupplierChange}
                onShippingFeeChange={logic.handleShippingFeeChange}
                shippingPartners={logic.shippingPartners}
                onPartnerChange={logic.handlePartnerChange}
                form={logic.form}
              />

              <div
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #f0f0f0",
                  minHeight: 500,
                }}
              >
                <div
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid #f0f0f0",
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  Sản phẩm
                </div>
                <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
                  <DebounceProductSelect
                    key={logic.searchKey}
                    placeholder="🔍 Tìm thuốc theo tên, hoạt chất, mã vạch..."
                    style={{ width: "100%" }}
                    fetcher={searchProductsForPurchase}
                    onChange={logic.handleSelectProduct}
                  />
                </div>
                <div style={{ padding: 16 }}>
                  <POProductTable
                    items={logic.itemsList}
                    onItemChange={logic.handleItemChange}
                    onRemove={logic.handleRemoveItem}
                  />
                </div>
              </div>
            </Col>

            {/* [FIXED] Thu hẹp cột Phải (Thanh toán): lg={6} (màn thường), xl={5} (màn siêu to) */}
            <Col xs={24} lg={6} xl={5}>
              <POPaymentSummary financials={logic.financials} />
            </Col>
          </Row>
        </Content>

        {/* [NEW] Payment Modal */}
        <FinanceFormModal
          open={logic.paymentModalOpen}
          onCancel={() => logic.setPaymentModalOpen(false)}
          initialFlow="out"
          initialValues={logic.paymentInitialValues}
        />

        {/* [NEW] Cost Allocation Modal */}
        <CostAllocationModal
          open={logic.costModalOpen}
          onCancel={() => logic.setCostModalOpen(false)}
          items={logic.itemsList}
          onConfirm={logic.handleConfirmFinancials}
          loading={logic.loading}
        />
      </Form>
    </Layout>
  );
};

const PurchaseOrderDetail = () => {
  return (
    <ConfigProvider locale={viVN}>
      <App>
        <PurchaseOrderDetailContent />
      </App>
    </ConfigProvider>
  );
};

export default PurchaseOrderDetail;
