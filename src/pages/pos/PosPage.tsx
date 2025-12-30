import { useEffect, useState } from "react";
import { Layout, Select, Space, Typography, Button, Tag, notification, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";

import { usePosCartStore } from "../../features/pos/stores/usePosCartStore";
import { posService } from "../../features/pos/api/posService";
import { WarehousePosData } from "../../features/pos/types/pos.types";

// Import Layout Components
import { PosLeftSection } from "../../features/pos/components/layout/PosLeftSection";
import { PosCustomerCard } from "../../features/pos/components/layout/PosCustomerCard";
import { PosPaymentSection } from "../../features/pos/components/layout/PosPaymentSection";
import { PosActionToolbar } from "../../features/pos/components/layout/PosActionToolbar";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

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
  const { clearCart } = usePosCartStore();

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
          let nearestId: number | null = null;
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
     Modal.confirm({
        title: 'Đổi kho bán hàng?',
        content: 'Việc đổi kho sẽ làm mới giỏ hàng hiện tại. Bạn chắc chắn chứ?',
        onOk: () => {
            clearCart();
            setCurrentWarehouseId(newId);
        }
     });
  };

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
       <Header style={{ background: "#5ab1dcff", padding: "0 16px", borderBottom: "1px solid #d9d9d9", display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
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
              <PosLeftSection /> 
          </Content>

          {/* === CỘT PHẢI: KHÁCH & THANH TOÁN (35%) === */}
          <Sider width={600} theme="light" style={{ borderLeft: '1px solid #d9d9d9', display: 'flex', flexDirection: 'column' }}>
             <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12 }}>
                <PosCustomerCard />
                <PosPaymentSection />
                <PosActionToolbar />
             </div>
          </Sider>
       </Layout>
    </Layout>
  );
};

export default PosPage;
