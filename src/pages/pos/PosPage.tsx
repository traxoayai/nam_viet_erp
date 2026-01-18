// src/pages/pos/PosPage.tsx
import { useEffect, useState } from "react";
import { Tabs, Layout, Select, Space, Typography, Button, Tag, notification, Modal, message } from "antd"; // Import Tabs
import { PlusOutlined } from "@ant-design/icons";

import { usePosCartStore } from "../../features/pos/stores/usePosCartStore";
import { posService } from "../../features/pos/api/posService";
import { WarehousePosData } from "../../features/pos/types/pos.types";
import { supabase } from "@/shared/lib/supabaseClient"; 
import { ScannerListener } from "@/shared/ui/warehouse-tools/ScannerListener";

// Import Layout Components
import { PosLeftSection } from "../../features/pos/components/layout/PosLeftSection";
import { PosCustomerCard } from "../../features/pos/components/layout/PosCustomerCard";
import { PosPaymentSection } from "../../features/pos/components/layout/PosPaymentSection";
import { PosActionToolbar } from "../../features/pos/components/layout/PosActionToolbar";

const { Header, Content } = Layout;
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
  const { 
      orders, activeOrderId, warehouseId, setWarehouseId,
      createOrder, setActiveOrder, removeOrder, addToCart, clearCart 
  } = usePosCartStore();
  // const searchRef = useRef<any>(null); // Không cần ref nữa vì dùng ScannerListener

  const [warehouses, setWarehouses] = useState<WarehousePosData[]>([]);

  // --- LOGIC 1: AUTO SELECT WAREHOUSE ---
  useEffect(() => {
    const initWarehouse = async () => {
      // 1. Lấy danh sách kho
      const list = await posService.getActiveWarehouses();
      setWarehouses(list);

      // Nếu store đã có kho rồi thì không cần auto select lại (để tránh override khi reload)
      if (warehouseId) return;

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

          // 4. Tự động chọn nếu gần (< 0.5km) 
          if (nearestId && minDistance < 0.5) {
             notification.success({
                 message: 'Tự động chọn kho',
                 description: `Đã chọn kho: ${nearestName} (Cách bạn ${Math.round(minDistance * 1000)}m)`
             });
             setWarehouseId(nearestId);
          } else {
             // Fallback: Chọn kho đầu tiên nếu không tìm thấy GPS
             setWarehouseId(list[0]?.id || null);
          }
        }, (error) => {
           console.warn("GPS Error:", error);
           setWarehouseId(list[0]?.id || null);
        });
      } else {
         setWarehouseId(list[0]?.id || null);
      }
    };
    initWarehouse();
  }, []); // Run once

  // [FIX] Logic Scanner (Sử dụng API search_products_pos V3 mới nhất)
  const handleScan = async (code: string) => {
      if (!warehouseId) return;
      const hide = message.loading("Đang tra cứu...", 0);
      try {
          // Gọi API tìm kiếm (Backend đã update tìm chính xác Barcode)
          const { data } = await supabase.rpc('search_products_pos', {
             p_keyword: code,
             p_limit: 1,
             p_warehouse_id: warehouseId
          });

          if (data && data.length > 0) {
              const product = data[0];
              addToCart(product); // Hàm này đã được fix lỗi map data ở trên
              // message.success(`Đã thêm: ${product.name}`); // addToCart đã báo rồi
          } else {
              message.error(`Không tìm thấy mã: ${code}`);
          }
      } catch (err) {
          console.error(err);
      } finally {
          hide();
      }
  };

  // --- LOGIC F1 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'F1') {
           e.preventDefault();
           createOrder();
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Tab Items
  const tabItems = orders.map(order => ({
      label: (
          <span>
              {order.name} 
              <span style={{ fontSize: 12, marginLeft: 8, color: activeOrderId === order.id ? '#1890ff' : '#888' }}>
                  ({order.items.length})
              </span>
          </span>
      ),
      key: order.id,
      closable: orders.length > 1,
  }));

  // --- LOGIC 2: XỬ LÝ ĐỔI KHO ---
  const handleChangeWarehouse = (newId: number) => {
     Modal.confirm({
        title: 'Đổi kho bán hàng?',
        content: 'Việc đổi kho sẽ làm mới giỏ hàng hiện tại. Bạn chắc chắn chứ?',
        onOk: () => {
            clearCart();
            setWarehouseId(newId);
        }
     });
  };

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
       {/* 1. Kích hoạt Scanner Listener Toàn Cục */}
       <ScannerListener onScan={handleScan} enabled={true} />
       {/* HEADER MỚI: Logo - Tabs - Actions */}
       <Header style={{ 
           background: "#215E61",
           padding: "0 16px", 
           display: 'flex', 
           alignItems: 'center', 
           height: 50,
           gap: 16
       }}>
           {/* Khu vực 1: Logo & Chọn Kho */}
           <Space>
               <Title level={4} style={{ margin: 0, color: '#fff', whiteSpace: 'nowrap', fontSize: 18 }}>NAM VIỆT POS</Title>
               <Select 
                   value={warehouseId}
                   onChange={handleChangeWarehouse}
                   style={{ width: 160 }} 
                   size="small"
                   options={warehouses.map(w => ({ label: w.name, value: w.id }))}
               />
           </Space>

           {/* Khu vực 2: Tabs Đơn Hàng (Nằm giữa, Flex 1) */}
           <div style={{ flex: 1, overflow: 'hidden', marginTop: 12 }}>
               <Tabs
                   type="editable-card"
                   onChange={setActiveOrder}
                   activeKey={activeOrderId}
                   onEdit={(targetKey, action) => {
                       if (action === 'add') createOrder();
                       else if (action === 'remove') removeOrder(targetKey as string);
                   }}
                   items={tabItems}
                   hideAdd // Ẩn nút + mặc định
                   size="small"
                   tabBarStyle={{ margin: 0, border: 'none', color: '#fff' }}
               />
           </div>

           {/* Khu vực 3: Nút F1 & Status */}
           <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={createOrder} size="small">
                    Đơn Mới (F1)
                </Button>
                <Tag color="success">Online</Tag>
           </Space>
       </Header>

       <Layout>
          {/* Content giữ nguyên Layout 2 cột */}
          <Content style={{ padding: '8px 12px 0 12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', gap: 12, height: '100%', paddingTop: 12 }}>
                  <div style={{ flex: 1 }}>
                      {/* Note: Store tự biết activeOrder -> Component con tự lấy data của activeOrder */}
                      <PosLeftSection /> 
                  </div>
                  <div style={{ width: 650 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* Các component này cũng đã update để dùng activeOrder */}
                            <PosCustomerCard />
                            <PosPaymentSection />
                            <PosActionToolbar />
                       </div>
                  </div>
              </div>
          </Content>
       </Layout>
    </Layout>
  );
};

export default PosPage;
