// src/pages/purchasing/PurchaseOrderDetail.tsx
import { Layout, Form, Row, Col, ConfigProvider, App } from "antd";
import viVN from "antd/locale/vi_VN";
//import React from "react";

// FIX: Import POItem từ file Type mới

import POGeneralInfo from "./components/POGeneralInfo";
import POHeaderAction from "./components/POHeaderAction";
import POPaymentSummary from "./components/POPaymentSummary";
import POProductTable from "./components/POProductTable";
import { usePurchaseOrderLogic } from "./hooks/usePurchaseOrderLogic";

import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";
import { searchProductsForPurchase } from "@/features/product/api/productService";
//import { POItem } from "@/types/purchaseOrderTypes";

const { Content } = Layout;

const PurchaseOrderDetailContent = () => {
  const logic = usePurchaseOrderLogic();

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Form form={logic.form} layout="vertical" onFinish={logic.onFinish}>
        <POHeaderAction
          isEditMode={logic.isEditMode}
          poCode={logic.poCode}
          poStatus={logic.poStatus} // Truyền status
          loading={logic.loading}
          onSave={() => logic.form.submit()}
          onSubmit={logic.confirmOrder}
          onRequestPayment={logic.requestPayment} // Truyền hàm mới
        />

        <Content
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            width: "100%",
            padding: "0 12px",
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={17}>
              <POGeneralInfo
                suppliers={logic.suppliers}
                supplierInfo={logic.supplierInfo}
                onSupplierChange={logic.handleSupplierChange}
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

            <Col xs={24} lg={7}>
              <POPaymentSummary
                financials={logic.financials}
                form={logic.form}
                calculateTotals={logic.calculateTotals}
                shippingPartners={logic.shippingPartners}
              />
            </Col>
          </Row>
        </Content>
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
