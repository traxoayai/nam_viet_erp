
// src/features/medical/components/DoctorBlock3_ServiceOrder.tsx
import React, { useState } from 'react';
import { Card, Empty, Button, Table, Space, Typography, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { FlaskConical } from 'lucide-react';
import DebounceProductSelect from '@/shared/ui/common/DebounceProductSelect';
import { medicalService } from '@/features/medical/api/medicalService';

const { Text } = Typography;

interface Props {
  readOnly?: boolean;
  serviceOrders?: any[]; // Danh sách các service order đã lưu / fetch
  onCheckout?: (selectedServicesJson: any[]) => void;
}

export const DoctorBlock3_ServiceOrder: React.FC<Props> = ({ readOnly, serviceOrders = [], onCheckout }) => {
  const [selectedServices, setSelectedServices] = useState<any[]>([]); // Dùng chung cho Table local state
  const [searchValue, setSearchValue] = useState<any>(null);
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Update table datasource khi có dữ liệu từ DB (Chỉ nhận thay đổi 1 chiều lúc load/reload DB)
  React.useEffect(() => {
    // Dữ liệu từ DB có structure khác (từ bảng clinical_service_requests), cần map lại cho giống lúc search
    const mappedDbServices = serviceOrders.map(so => ({
        id: so.service_package_id,  // Dùng package ID thay vì request ID để check trùng với list search
        request_id: so.id,          // Giữ ID request của DB để gọi API Checkout
        name: so.service_name_snapshot,
        sku: 'Saved', 
        clinical_category: so.category,
        unit: 'Lần',
        price: so.price || 0, // Fallback
        retail_price: so.price || 0,
        payment_order_id: so.payment_order_id
    }));

    // Giữ lại item mới add chưa lưu, lọc đi item đã lưu để merge mới
    setSelectedServices(prev => {
        const newUnsaved = prev.filter(p => 
            !p.request_id && !mappedDbServices.some(dbItem => dbItem.id === p.id)
        );
        return [...mappedDbServices, ...newUnsaved];
    });

  }, [serviceOrders]);

  const handleAddService = (_: any, option: any) => {
    if (!option || !option.product) return;
    const service = option.product;
    
    // Kiểm tra trùng
    if (selectedServices.some(s => s.id === service.id)) return;

    setSelectedServices(prev => [...prev, service]);
    setSearchValue(null); // Clear search
  };

  const handleRemove = (id: number) => {
    setSelectedServices(prev => prev.filter(s => s.id !== id));
  };

  const columns = [
    {
      title: 'Tên dịch vụ / Chỉ định',
      dataIndex: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Space>
             <Text strong>{text || 'Dịch vụ'}</Text>
             {record.payment_order_id && <Tag color="green" style={{fontSize: 9, margin: 0}}>[Đã TT]</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sku}</Text>
        </Space>
      )
    },
    {
      title: 'Phân loại',
      dataIndex: 'clinical_category',
      width: 120,
      render: (cat: string) => {
        if (cat === "lab") return <Tag color="blue">Xét nghiệm</Tag>;
        if (cat === "imaging") return <Tag color="purple">CĐHA</Tag>;
        if (cat === "procedure") return <Tag color="orange">Thủ thuật</Tag>;
        if (cat === "examination") return <Tag color="green">Khám bệnh</Tag>;
        return <Text type="secondary">-</Text>;
      }
    },
    {
      title: 'ĐVT',
      dataIndex: 'unit',
      width: 80,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: any) => (
        <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined size={16} />} 
            onClick={() => handleRemove(record.id)} 
            disabled={readOnly || !!record.payment_order_id || !!record.request_id} // Disable xoá nếu Đã là DB record
        />
      )
    }
  ];

  return (
    <Card 
        size="small" 
        title={<span className="flex items-center gap-2"><FlaskConical size={16}/> Chỉ định Cận Lâm Sàng</span>}
        className="mb-4 shadow-sm"
    >
        {!readOnly && (
            <div style={{ marginBottom: 16 }}>
                <DebounceProductSelect
                    value={searchValue}
                    onChange={handleAddService}
                    placeholder="🔍 Tìm xét nghiệm, siêu âm, X-Quang..."
                    fetcher={medicalService.searchClinicalServices}
                    style={{ width: "100%" }}
                />
            </div>
        )}

        {selectedServices.length === 0 ? (
            <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="Chưa có chỉ định nào" 
                className="my-2"
            />
        ) : (
            <div className="flex flex-col">
                <Table 
                    dataSource={selectedServices}
                    columns={columns}
                    rowKey="id" // Dùng package.id hoặc temp id
                    pagination={false}
                    size="small"
                    bordered
                    rowSelection={!readOnly ? {
                       selectedRowKeys,
                       onChange: setSelectedRowKeys,
                       getCheckboxProps: (record: any) => ({
                           disabled: !!record.payment_order_id
                       })
                    } : undefined}
                />
                
                {/* FOOTER ACTION */}
                {!readOnly && (
                    <div className="p-3 bg-gray-50 border border-t-0 flex justify-between items-center rounded-b">
                        <Space>
                           <Text strong>Đã chọn:</Text>
                           <span className="text-blue-600 font-bold">{selectedRowKeys.length}</span> dịch vụ
                        </Space>

                        <Space>
                            <span className="text-gray-500 mr-2">Cần thanh toán:</span>
                            <span className="text-red-500 font-bold text-lg">
                                {selectedServices
                                    .filter(s => selectedRowKeys.includes(s.id))
                                    .reduce((acc, curr) => acc + (curr.price || curr.retail_price || 0), 0)
                                    .toLocaleString()} ₫
                            </span>
                            <Button 
                                type="primary" 
                                style={{ backgroundColor: '#fa8c16' }}
                                disabled={selectedRowKeys.length === 0}
                                onClick={() => {
                                    // Gửi luôn danh sách các dịch vụ dạng Object cho RPC xử lý JSON
                                    const selectedItemsToPay = selectedServices.filter(s => selectedRowKeys.includes(s.id));
                                    if (onCheckout) onCheckout(selectedItemsToPay);
                                    setSelectedRowKeys([]); // Reset sau khi gọi
                                }}
                            >
                                Thu tiền tại bàn
                            </Button>
                        </Space>
                    </div>
                )}
            </div>
        )}
    </Card>
  );
};
