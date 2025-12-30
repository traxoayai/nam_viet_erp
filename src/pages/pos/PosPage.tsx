// src/pages/posPage.tsx
import React, { useEffect, useState } from "react";
import { Layout, Card, Button, Typography, Row, Col, Divider, Space, Tag, Select, Modal, notification } from "antd"; // Import thêm
import { 
  PlusOutlined, WalletOutlined, QrcodeOutlined, 
  PrinterOutlined, FileTextOutlined, AuditOutlined, UserOutlined 
} from "@ant-design/icons";

// Import Components Lát Cắt
import { PosSearchInput } from "../../features/pos/components/PosSearchInput";
import { PosCartTable } from "../../features/pos/components/PosCartTable";
import { usePosCartStore } from "../../features/pos/stores/usePosCartStore";

import { posService } from "../../features/pos/api/posService";
import { WarehousePosData } from "../../features/pos/types/pos.types";
import { PosCustomerSearch } from "../../features/pos/components/PosCustomerSearch"; // Import Search mới

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

// Utils tính khoảng cách (Core cung cấp)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const PosPage = () => {
  const { 
    getTotals, 
    customer, 
    isInvoiceRequested, 
    toggleInvoiceRequest,
    setCustomer, // Tạm thời chưa làm component chọn khách, sẽ hardcode test trước
    clearCart
  } = usePosCartStore();

  const [warehouses, setWarehouses] = useState<WarehousePosData[]>([]);
  const [currentWarehouseId, setCurrentWarehouseId] = useState<number | null>(null);

  // --- LOGIC 1: AUTO SELECT WAREHOUSE ---
  useEffect(() => {
    const initWarehouse = async () => {
      // 1. Lấy danh sách kho
      const list = await posService.getActiveWarehouses();
      setWarehouses(list);

      // 2. Lấy GPS hiện tại
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;
          
          // 3. Tính khoảng cách
          let minDistance = Infinity;
          let nearestId = null;
          let nearestName = "";

          list.forEach(w => {
             if (w.latitude && w.longitude) {
                 const dist = getDistanceFromLatLonInKm(latitude, longitude, w.latitude, w.longitude);
                 if (dist < minDistance) {
                     minDistance = dist;
                     nearestId = w.id;
                     nearestName = w.name;
                 }
             }
          });

          // 4. Tự động chọn nếu gần (< 0.5km) và chưa chọn kho nào
          if (nearestId && minDistance < 0.5) {
             setCurrentWarehouseId((prev) => {
                 if (!prev) {
                     notification.success({
                         message: 'Tự động chọn kho',
                         description: `Đã chọn kho: ${nearestName} (Cách bạn ${Math.round(minDistance * 1000)}m)`
                     });
                     return nearestId;
                 }
                 return prev;
             });
          } else {
             // Fallback: Chọn kho đầu tiên nếu không tìm thấy GPS
             setCurrentWarehouseId((prev) => prev || list[0]?.id);
          }
        }, (error) => {
           console.warn("GPS Error:", error);
           setCurrentWarehouseId((prev) => prev || list[0]?.id);
        });
      } else {
         setCurrentWarehouseId((prev) => prev || list[0]?.id);
      }
    };
    initWarehouse();
  }, []);

  // --- LOGIC 2: XỬ LÝ ĐỔI KHO ---
  const handleChangeWarehouse = (newId: number) => {
     // Cảnh báo nếu giỏ hàng đang có hàng (Tùy chọn, ở đây ta Clear luôn cho an toàn)
     // Hoặc cảnh báo GPS nếu chọn kho quá xa (như Sếp yêu cầu)
     
     // Ví dụ cảnh báo xa (nếu có GPS) -> Đoạn này Dev tự implement thêm nếu cần gắt gao.
     
     Modal.confirm({
        title: 'Đổi kho bán hàng?',
        content: 'Việc đổi kho sẽ làm mới giỏ hàng hiện tại. Bạn chắc chắn chứ?',
        onOk: () => {
            clearCart();
            setCurrentWarehouseId(newId);
        }
     });
  };

  const totals = getTotals();

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
       <Header style={{ background: "#5ab1dcff", padding: "0 16px", borderBottom: "1px solid #d9d9d9", display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
          {/* Thay Tag KHO TỔNG bằng Select */}
          <Space>
             <Title level={4} style={{ margin: 0, color: '#ae6a21ff' }}>NAM VIỆT POS</Title>
             <Select 
                value={currentWarehouseId}
                onChange={handleChangeWarehouse}
                style={{ width: 200 }}
                options={warehouses.map(w => ({ label: w.name, value: w.id }))}
             />
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
              {currentWarehouseId ? (
                 <PosSearchInput 
                    warehouseId={currentWarehouseId} 
                    onSelectProduct={(p) => usePosCartStore.getState().addToCart(p)} 
                 />
              ) : <Tag color="warning">Vui lòng chọn kho để bán hàng</Tag>}
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
                    <PosCustomerSearch onSelect={(c) => setCustomer(c)} />
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
