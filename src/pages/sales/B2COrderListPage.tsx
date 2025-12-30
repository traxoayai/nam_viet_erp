import React, { useState } from 'react';
import { Table, Tag, Button, Space, Card, DatePicker, Typography, Row, Col } from 'antd';
import { PrinterOutlined, BankOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useSalesOrders } from '@/features/sales/hooks/useSalesOrders'; // Hook wrapper for salesService

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const B2COrderListPage = () => {
  // Gọi Service với orderType = 'POS'
  const { orders, loading, stats, refetch, setFilters } = useSalesOrders({ orderType: 'POS' });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Columns Definition
  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'code',
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      render: (d: string) => <div style={{fontSize: 13}}>{new Date(d).toLocaleString('vi-VN')}</div>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer_name',
      render: (name: string, r: any) => (
        <div>
            <div style={{fontWeight: 500}}>{name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{r.customer_phone}</div>
        </div>
      )
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'final_amount',
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString()} ₫</Text>,
    },
    {
      title: 'HTTT',
      dataIndex: 'payment_method',
      align: 'center' as const,
      render: (val: string) => val === 'transfer' ? <Tag color="blue">CK</Tag> : <Tag color="orange">Tiền mặt</Tag>
    },
    {
      title: 'Trạng thái nộp',
      dataIndex: 'remittance_status',
      align: 'center' as const,
      render: (status: string) => {
          if(status === 'deposited') return <Tag color="success" icon={<CheckCircleOutlined />}>Đã vào quỹ</Tag>;
          if(status === 'confirming') return <Tag color="warning">Chờ duyệt</Tag>;
          if(status === 'skipped') return <Tag>Nợ (Không nộp)</Tag>;
          return <Tag color="red">Chưa nộp</Tag>; // Pending
      }
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: () => <Button type="text" icon={<PrinterOutlined />} />
    }
  ];

  return (
    <div style={{ padding: 12, background: '#f0f2f5', minHeight: '100vh' }}>
       {/* 1. Stats Bar (Dashboard Mini) */}
       <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={8}>
             <Card size="small" bordered={false}>
                <div style={{ color: '#888' }}>Doanh số POS (Tháng này)</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                   {stats?.total_sales?.toLocaleString()} ₫
                </div>
             </Card>
          </Col>
          <Col span={8}>
             <Card size="small" bordered={false}>
                <div style={{ color: '#888' }}>Tiền mặt chưa nộp</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#cf1322' }}>
                   {stats?.total_cash_pending?.toLocaleString()} ₫
                </div>
             </Card>
          </Col>
       </Row>

       {/* 2. Main Table */}
       <Card 
          bodyStyle={{ padding: 0 }}
          title={
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                   <Title level={5} style={{ margin: 0 }}>Lịch sử Bán Lẻ</Title>
                   <RangePicker style={{ width: 240 }} onChange={(dates) => {
                       // Handle Date Filter logic here
                       if(dates && dates[0] && dates[1]) {
                           setFilters({ 
                               dateFrom: dates[0].toISOString(),
                               dateTo: dates[1].toISOString()
                           });
                       } else {
                           setFilters({ dateFrom: undefined, dateTo: undefined });
                       }
                   }} />
                </Space>
                <Space>
                   {selectedRowKeys.length > 0 && (
                       <Button type="primary" danger icon={<BankOutlined />}>
                           Nộp tiền ({selectedRowKeys.length})
                       </Button>
                   )}
                   <Button icon={<SyncOutlined />} onClick={refetch} />
                </Space>
             </div>
          }
       >
          <Table 
             dataSource={orders} 
             columns={columns} 
             rowKey="id"
             loading={loading}
             pagination={{ pageSize: 10 }}
             rowSelection={{
                 selectedRowKeys,
                 onChange: setSelectedRowKeys,
                 getCheckboxProps: (r: any) => ({
                     // Chỉ cho chọn đơn "Chưa nộp" và là "Tiền mặt" (hoặc cả CK tùy quy trình)
                     disabled: r.remittance_status !== 'pending', 
                 }),
             }}
          />
       </Card>
    </div>
  );
};

export default B2COrderListPage;
