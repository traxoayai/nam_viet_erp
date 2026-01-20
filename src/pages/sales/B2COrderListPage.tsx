// src/pages/sales/B2COrderListPage.tsx
import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Card, DatePicker, Typography, Row, Col, Modal, message } from 'antd';
import { PrinterOutlined, BankOutlined, CheckCircleOutlined, SyncOutlined, ExclamationCircleOutlined, UserOutlined, AlertOutlined } from '@ant-design/icons';
import { useSalesOrders } from '@/features/sales/hooks/useSalesOrders';
import { posTransactionService } from '@/features/finance/api/posTransactionService'; 
import { useAuth } from '@/app/contexts/AuthProvider';
import { VatActionButton } from '@/features/pos/components/VatActionButton';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const B2COrderListPage = () => {
  const { orders, loading, stats, refetch, setFilters } = useSalesOrders({ orderType: 'POS' });
  const { user } = useAuth();
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // [NEW STATE] Doanh thu treo (Trách nhiệm)
  const [pendingRevenue, setPendingRevenue] = useState<number>(0);

  // Load công nợ
  useEffect(() => {
      if (user) loadPendingRevenue();
  }, [user, orders]); // Reload khi user hoặc orders thay đổi

  const loadPendingRevenue = async () => {
      if (!user) return;
      // Gọi hàm mới lấy cả tiền mặt và CK
      const amount = await posTransactionService.getUserPendingRevenue(user.id);
      setPendingRevenue(amount);
  };

  const handleRemitCash = () => {
    const selectedOrders = orders.filter(o => selectedRowKeys.includes(o.id));
    
    // Logic nộp tiền: Chỉ nộp Tiền mặt (Cash). 
    // Tiền CK thì Kế toán tự đối soát, Dược sĩ không cầm tiền nên không nộp được.
    const cashOrders = selectedOrders.filter(o => o.payment_method === 'cash' && o.remittance_status === 'pending');
    
    // Tính tổng tiền mặt
    const totalCash = cashOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);

    // Cảnh báo nếu chọn nhầm đơn CK
    const hasTransfer = selectedOrders.some(o => o.payment_method === 'transfer');

    if (cashOrders.length === 0) {
        message.warning("Không có đơn TIỀN MẶT nào cần nộp trong các đơn đã chọn.");
        return;
    }

    const depositorName = user?.user_metadata?.full_name || user?.email || 'N/A';

    Modal.confirm({
        title: 'Nộp doanh thu Tiền Mặt',
        icon: <ExclamationCircleOutlined />,
        width: 500,
        content: (
            <div>
                <div style={{marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #ddd'}}>
                    <div style={{fontSize: 13, color: '#666'}}>Người nộp:</div>
                    <div style={{fontSize: 15, fontWeight: 600, color: '#1890ff', display:'flex', alignItems:'center', gap: 6}}>
                        <UserOutlined /> {depositorName}
                    </div>
                </div>

                <p>Bạn đang chọn <b>{selectedOrders.length}</b> đơn hàng.</p>
                
                {hasTransfer && (
                    <div style={{color: '#faad14', fontSize: 12, marginBottom: 8}}>
                        <ExclamationCircleOutlined /> Các đơn <b>Chuyển khoản</b> sẽ được bỏ qua (chờ Kế toán đối soát).
                    </div>
                )}

                <div style={{background: '#fffbe6', padding: 10, border: '1px solid #ffe58f', borderRadius: 6, marginBottom: 10}}>
                    <div style={{fontSize: 12, color: '#666'}}>Tổng tiền mặt thực nộp:</div>
                    <Text type="danger" strong style={{fontSize: 20}}>{totalCash.toLocaleString()} ₫</Text>
                </div>
                <div style={{fontSize: 12, color: '#888'}}>
                    * Phiếu thu sẽ được tạo ở trạng thái <b>Chờ duyệt</b>.<br/>
                    * Hãy mang tiền mặt nộp cho Thủ quỹ để xóa nợ.
                </div>
            </div>
        ),
        okText: 'Xác nhận nộp',
        cancelText: 'Hủy',
        onOk: async () => {
            try {
                const uuidList = selectedRowKeys.map(key => String(key));
                const result = await posTransactionService.submitRemittance(uuidList);
                
                Modal.success({
                    title: 'Đã tạo phiếu nộp tiền!',
                    content: (
                        <div>
                            <p>Số tiền: <b>{result.total_amount.toLocaleString()} ₫</b></p>
                            <p>Mã phiếu: <Tag color="blue">{result.transaction_code}</Tag></p>
                            <p>Trạng thái: <b>Chờ duyệt</b></p>
                        </div>
                    ),
                    onOk: () => {
                        setSelectedRowKeys([]); 
                        refetch(); 
                    }
                });
            } catch (error: any) {
                console.error(error);
                message.error(error.message || "Lỗi khi nộp tiền.");
            }
        }
    });
  };

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
            <div style={{fontWeight: 500}}>{name || 'Khách lẻ'}</div>
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
          if(status === 'confirming') return <Tag color="processing" icon={<SyncOutlined spin />}>Chờ duyệt</Tag>;
          if(status === 'skipped') return <Tag>Nợ (Không nộp)</Tag>;
          return <Tag color="error">Chưa nộp</Tag>; 
      }
    },
    {
        title: "Hóa Đơn",
        key: "invoice_action",
        width: 140,
        align: "center" as const,
        render: (_: any, record: any) => (
            <VatActionButton 
                // Lấy phần tử đầu tiên của mảng sales_invoices (do API trả về)
                invoice={record.sales_invoices?.[0] || { id: null, status: 'pending' }}
                orderItems={record.order_items || []} 
                customer={{
                    name: record.customer_name,
                    phone: record.customer_phone,
                    tax_code: record.tax_code, 
                    email: record.customer_email
                }}
                onUpdate={() => refetch()} // Gọi hàm refresh của hook useSalesOrders
            />
        )
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
       {/* DASHBOARD STATS */}
       <Row gutter={16} style={{ marginBottom: 12 }}>
          {/* [WIDGET DOANH THU TREO - CẢ TIỀN MẶT & CK] */}
          <Col span={8}>
             <Card size="small" bordered={false} style={{borderLeft: '4px solid #faad14'}}>
                <Space>
                    <AlertOutlined style={{fontSize: 20, color: '#faad14'}} />
                    <div style={{ color: '#888' }}>Số tiền chưa nộp (Của bạn)</div>
                </Space>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: pendingRevenue > 0 ? '#faad14' : '#52c41a', marginTop: 4 }}>
                   {pendingRevenue.toLocaleString()} ₫
                </div>
                <div style={{fontSize: 11, color: '#555'}}>
                    {pendingRevenue > 0 ? '(Gồm Tiền mặt chưa nộp & CK chưa đối soát)' : '(Đã nộp + Đối soát toàn bộ)'}
                </div>
             </Card>
          </Col>

          {/* Doanh số chung */}
          <Col span={8}>
             <Card size="small" bordered={false}>
                <div style={{ color: '#888' }}>Tổng doanh số POS (Tháng)</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff', marginTop: 4 }}>
                   {stats?.total_sales?.toLocaleString()} ₫
                </div>
             </Card>
          </Col>
          
          <Col span={8}>
             <Card size="small" bordered={false}>
                <div style={{ color: '#888' }}>Tiền mặt chưa nộp (Toàn CH)</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#cf1322', marginTop: 4 }}>
                   {stats?.total_cash_pending?.toLocaleString()} ₫
                </div>
             </Card>
          </Col>
       </Row>

       {/* MAIN TABLE */}
       <Card 
          bodyStyle={{ padding: 0 }}
          title={
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                   <Title level={5} style={{ margin: 0 }}>Lịch sử Bán Lẻ</Title>
                   <RangePicker style={{ width: 240 }} onChange={(dates) => {
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
                       <Button 
                            type="primary" 
                            danger 
                            icon={<BankOutlined />}
                            onClick={handleRemitCash}
                       >
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
                 onChange: (keys) => setSelectedRowKeys(keys),
                 getCheckboxProps: (r: any) => ({
                     // Vẫn chỉ cho chọn đơn chưa nộp
                     disabled: r.remittance_status !== 'pending', 
                 }),
             }}
          />
       </Card>
    </div>
  );
};

export default B2COrderListPage;