import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Select, 
  Input, 
  Button, 
  Form, 
  Space, 
  Typography, 
  message, 
  Row, 
  Col,
} from 'antd';
import { 
  SaveOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useTransferStore } from '@/features/inventory/stores/useTransferStore';
import { getWarehouses } from '@/features/inventory/api/warehouseService';
import { TransferCartItem } from '@/features/inventory/types/transfer';
import TransferProductSearch from './components/TransferProductSearch';
import TransferProductTable from './components/TransferProductTable';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TransferCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createTransfer, loading } = useTransferStore();
  
  // Data States
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<TransferCartItem[]>([]);
  
  // Form States
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [destId, setDestId] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // 1. Initial Load
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const { data } = await getWarehouses({}, 1, 100);
        setWarehouses(data);
      } catch (err) {
        message.error('Lỗi tải danh sách kho');
      }
    };
    loadWarehouses();
  }, []);

  // 2. Handle Source Change (Warning before clear)
  const handleSourceChange = (val: number) => {
    if (items.length > 0) {
      if(!window.confirm("Thay đổi kho xuất sẽ xóa danh sách hàng đã chọn. Tiếp tục?")) return;
      setItems([]);
    }
    setSourceId(val);
  };

  // 3. Handle Select Product (From Search)
  const handleSelectProduct = (product: any) => {
    // Check duplicates
    if (items.some(i => i.product_id === product.id)) {
        message.warning(`Sản phẩm "${product.name}" đã có trong danh sách`);
        return;
    }

    // Map RPC data to Cart Item
    const newItem: TransferCartItem = {
        key: Date.now().toString(),
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        image_url: product.image_url,
        
        // Data from Core
        current_stock: product.current_stock || 0,
        shelf_location: product.shelf_location,
        lot_hint: product.lot_number,
        expiry_hint: product.expiry_date,
        
        // Smart Unit
        unit: product.unit || 'Cái',
        conversion_factor: product.conversion_factor || 1,
        
        quantity: 1,
        base_quantity: product.conversion_factor || 1, // 1 * conversion
        error: undefined
    };

    // Validate stock immediately upon add
    if (newItem.base_quantity > newItem.current_stock) {
        newItem.error = `Vượt quá tồn kho (${newItem.current_stock})`;
    }

    setItems([...items, newItem]);
    message.success(`Đã thêm: ${product.name}`);
  };

  // 4. Handle Quantity Change (Recalculate & Validate)
  const handleQuantityChange = (key: string, qty: number) => {
      setItems(prev => prev.map(item => {
          if (item.key !== key) return item;
          
          const newBase = qty * item.conversion_factor;
          let error = undefined;
          
          if (newBase > item.current_stock) {
              error = `Vượt quá tồn kho (${item.current_stock})`;
          }

          return {
              ...item,
              quantity: qty,
              base_quantity: newBase,
              error
          };
      }));
  };

  const handleRemoveItem = (key: string) => {
      setItems(prev => prev.filter(i => i.key !== key));
  };

  // 5. Submit Logic
  const handleSubmit = async () => {
      // 1. Basic Validation
      if (!sourceId || !destId) return message.error("Vui lòng chọn Kho Xuất và Kho Nhập!");
      if (sourceId === destId) return message.error("Kho Nhập không được trùng Kho Xuất!");
      if (items.length === 0) return message.error("Vui lòng thêm ít nhất 1 sản phẩm!");
      
      // 2. Validate Items (Again)
      const invalidItems = items.filter(i => i.base_quantity > i.current_stock);
      if (invalidItems.length > 0) {
          return message.error(`Có ${invalidItems.length} sản phẩm vượt quá tồn kho. Vui lòng kiểm tra lại!`);
      }

      // 3. Submit
      const success = await createTransfer({
          p_source_warehouse_id: sourceId,
          p_dest_warehouse_id: destId,
          p_note: note,
          p_items: items.map(i => ({
              product_id: i.product_id,
              quantity: i.quantity,
              unit: i.unit,
              conversion_factor: i.conversion_factor
          }))
      });

      if (success) {
          navigate('/inventory/transfer');
      }
  };

  return (
    <div style={{ padding: 24, paddingBottom: 100 }}>
       {/* HEADER */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
           <Space>
               <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventory/transfer')} />
               <div>
                   <Title level={3} style={{ margin: 0 }}>Tạo Phiếu Chuyển Kho</Title>
                   <Text type="secondary">Chuyển hàng nội bộ giữa các kho</Text>
               </div>
           </Space>
           <Space>
               <Button onClick={() => navigate('/inventory/transfer')}>Hủy bỏ</Button>
               <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={loading} size="large">
                   Hoàn tất
               </Button>
           </Space>
       </div>

       <Row gutter={24}>
           {/* LEFT COLUMN: INFO */}
           <Col span={6}>
               <Card title="Thông tin phiếu" bordered={false} style={{ height: '100%' }}>
                   <Form layout="vertical">
                       <Form.Item label="Kho Xuất (Source)" required tooltip="Nơi hàng được lấy đi">
                           <Select 
                              placeholder="Chọn kho xuất..." 
                              value={sourceId}
                              onChange={handleSourceChange}
                              size="large"
                           >
                               {warehouses.map(w => (
                                   <Option key={w.id} value={w.id} disabled={w.id === destId || w.type === 'virtual'}>{w.name}</Option>
                               ))}
                           </Select>
                       </Form.Item>
                       
                       <Form.Item label="Kho Nhập (Destination)" required tooltip="Nơi hàng sẽ được chuyển đến">
                            <Select 
                              placeholder="Chọn kho nhập..." 
                              value={destId}
                              onChange={setDestId}
                              size="large"
                            >
                               {warehouses.map(w => (
                                   <Option key={w.id} value={w.id} disabled={w.id === sourceId}>{w.name}</Option>
                               ))}
                           </Select>
                       </Form.Item>

                       <Form.Item label="Ghi chú">
                           <TextArea 
                                rows={6} 
                                value={note} 
                                onChange={e => setNote(e.target.value)} 
                                placeholder="Nhập lý do chuyển, người yêu cầu, v.v..."
                           />
                       </Form.Item>
                   </Form>
               </Card>
           </Col>
           
           {/* RIGHT COLUMN: ITEMS */}
           <Col span={18}>
               <Card 
                  title="Danh sách hàng hóa" 
                  bordered={false} 
                  extra={
                      <div style={{ width: 600 }}>
                          <TransferProductSearch 
                              sourceWarehouseId={sourceId}
                              onSelect={handleSelectProduct}
                          />
                      </div>
                  }
               >
                   <TransferProductTable 
                        items={items}
                        onChangeQuantity={handleQuantityChange}
                        onRemove={handleRemoveItem}
                   />
               </Card>
           </Col>
       </Row>
    </div>
  );
};

export default TransferCreatePage;
