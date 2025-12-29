// src/pages/pos/PosPage.tsx
// import React, { useEffect } from "react";
import { Layout, Card, Button, Typography, Row, Col, Divider, Space, Tag } from "antd";
import { 
  PlusOutlined, WalletOutlined, QrcodeOutlined, 
  PrinterOutlined, FileTextOutlined, AuditOutlined, UserOutlined 
} from "@ant-design/icons";

// Import Components Lát Cắt
import { PosSearchInput } from "../../features/pos/components/PosSearchInput";
import { PosCartTable } from "../../features/pos/components/PosCartTable";
import { usePosCartStore } from "../../features/pos/stores/usePosCartStore";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const PosPage = () => {
  const { 
    getTotals, 
    customer, 
    isInvoiceRequested, 
    toggleInvoiceRequest,
    setCustomer // Tạm thời chưa làm component chọn khách, sẽ hardcode test trước
  } = usePosCartStore();

  const totals = getTotals();

  // Giả lập chọn khách hàng để test tính năng nợ
  const mockSelectCustomer = () => {
      setCustomer({ id: 10, name: "Nguyễn Văn A", phone: "0909123456", debt_amount: 50000 }); // Khách đang nợ 50k
  };

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      {/* HEADER */}
      <Header style={{ background: "#5ab1dcff", padding: "0 16px", borderBottom: "1px solid #d9d9d9", display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
         <Space>
            <Title level={4} style={{ margin: 0, color: '#ae6a21ff' }}>NAM VIỆT POS</Title>
            <Tag color="blue">KHO TỔNG</Tag>
         </Space>
         <Space>
            <Button type="dashed" icon={<PlusOutlined />}>Đơn Mới (F1)</Button>
            <Tag color="success">Online</Tag>
         </Space>
      </Header>

      <Layout>
        {/* === CỘT TRÁI: TÌM KIẾM & GIỎ HÀNG (65%) === */}
        <Content style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
           
           {/* Ô TÌM KIẾM THÔNG MINH */}
           <Card bodyStyle={{ padding: 12 }}>
              <PosSearchInput 
                  warehouseId={1} // Hardcode ID kho = 1 (sau này lấy từ Auth)
                  onSelectProduct={(p) => usePosCartStore.getState().addToCart(p)} 
              />
           </Card>

           {/* BẢNG GIỎ HÀNG */}
           <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: 0, flex: 1, overflow: 'hidden' }}>
              <PosCartTable />
           </Card>
        </Content>

        {/* === CỘT PHẢI: KHÁCH & THANH TOÁN (35%) === */}
        <Sider width={700} theme="light" style={{ borderLeft: '0px solid #d9d9d9', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12 }}>
              
              {/* 1. KHÁCH HÀNG */}
              <Card size="small" title={<Space><UserOutlined /> Khách Hàng</Space>} style={{ marginBottom: 12 }}>
                 {customer ? (
                     <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong>{customer.name}</Text>
                            <Text>{customer.phone}</Text>
                        </div>
                        {customer.debt_amount > 0 && (
                            <Tag color="red" style={{ marginTop: 8 }}>Nợ cũ: {customer.debt_amount.toLocaleString()} đ</Tag>
                        )}
                        <Button type="link" size="small" onClick={() => setCustomer(null)} style={{ padding: 0, marginTop: 4 }}>Bỏ chọn</Button>
                     </div>
                 ) : (
                     <Button type="dashed" onClick={mockSelectCustomer}>+ Chọn Khách (Test)</Button>
                 )}
              </Card>

              {/* 2. THANH TOÁN */}
              <Card size="small" title="Thanh Toán" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                 
                 {/* Summary */}
                 <div style={{ flex: 1 }}>
                    <Row justify="space-between" style={{ marginBottom: 8 }}>
                       <Text>Tổng tiền hàng:</Text>
                       <Text strong>{totals.subTotal.toLocaleString()}</Text>
                    </Row>
                    <Row justify="space-between" style={{ marginBottom: 8 }}>
                       <Text>Giảm giá:</Text>
                       <Text type="success">-{totals.discountVal.toLocaleString()}</Text>
                    </Row>
                    <Row justify="space-between" style={{ marginBottom: 8 }}>
                       <Text>Nợ cũ:</Text>
                       <Text type="danger">+{totals.debtAmount.toLocaleString()}</Text>
                    </Row>
                    
                    <Divider style={{ margin: "12px 0" }} />
                    
                    <Row justify="space-between" align="middle">
                       <Title level={4} style={{ margin: 0, color: '#0050b3' }}>KHÁCH PHẢI TRẢ:</Title>
                       <Title level={3} style={{ margin: 0, color: '#cf1322' }}>{totals.grandTotal.toLocaleString()}</Title>
                    </Row>
                 </div>

                 {/* Nút chức năng */}
                 <div style={{ marginTop: 16 }}>
                    <Row gutter={[8, 8]}>
                       <Col span={8}><Button block icon={<PrinterOutlined />} size="small">In Bill</Button></Col>
                       <Col span={8}><Button block icon={<FileTextOutlined />} size="small">HDSD</Button></Col>
                       <Col span={8}>
                           <Button 
                              block 
                              size="small"
                              type={isInvoiceRequested ? "primary" : "default"}
                              icon={<AuditOutlined />}
                              onClick={toggleInvoiceRequest}
                           >
                              {isInvoiceRequested ? "Đã Chọn VAT" : "Lấy HĐ VAT"}
                           </Button>
                       </Col>
                       
                       <Col span={12}>
                          <Button type="primary" block size="large" icon={<WalletOutlined />} style={{ height: 50, background: '#fa8c16' }}>
                             TIỀN MẶT (F9)
                          </Button>
                       </Col>
                       <Col span={12}>
                          <Button block size="large" icon={<QrcodeOutlined />} style={{ height: 50, background: '#b5b7ffff' }} >CK (F10)</Button>
                       </Col>
                    </Row>
                 </div>

              </Card>
           </div>
        </Sider>
      </Layout>
    </Layout>
  );
};

export default PosPage;
