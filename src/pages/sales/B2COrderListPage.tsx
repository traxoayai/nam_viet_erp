// src/pages/sales/B2COrderListPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Button, Space, Typography, Modal, message, Avatar } from 'antd';
import { 
    BankOutlined, CheckCircleOutlined, SyncOutlined, 
    ExclamationCircleOutlined, UserOutlined, AlertOutlined, ShopOutlined, PrinterOutlined 
} from '@ant-design/icons';
import dayjs from "dayjs";

import { useSalesOrders } from '@/features/sales/hooks/useSalesOrders';
import { posTransactionService } from '@/features/finance/api/posTransactionService'; 
import { useAuth } from '@/app/contexts/AuthProvider';
import { VatActionButton } from '@/features/pos/components/VatActionButton';
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { supabase } from "@/shared/lib/supabaseClient";

const { Text } = Typography;

const B2COrderListPage = () => {
  // Hooks
  const { tableProps, filterProps, stats, currentFilters, refresh } = useSalesOrders({ orderType: 'POS' });
  const { user } = useAuth();
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pendingRevenue, setPendingRevenue] = useState<number>(0);
  const [creators, setCreators] = useState<any[]>([]);

  // [NEW STATE]
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // 1. Load Data bổ trợ (Doanh thu treo & List User & Warehouse)
  useEffect(() => {
    // Load Pending Revenue
    if (user) {
        posTransactionService.getUserPendingRevenue(user.id).then(setPendingRevenue);
    }
    // Load Users for Filter
    supabase.from('users').select('id, full_name, email').then(({ data }) => setCreators(data || []));
    // Load Warehouses for Filter
    supabase.from('warehouses').select('id, name').then(({ data }) => setWarehouses(data || []));
  }, [user, currentFilters]); // Reload revenue khi filter thay đổi (có thể đơn mới tạo)

  // 2. Logic Nộp tiền (Giữ nguyên)
  const handleRemitCash = () => {
    const orders = tableProps.dataSource || [];
    const selectedOrders = orders.filter((o: any) => selectedRowKeys.includes(o.id));
    
    // Logic nộp tiền: Chỉ nộp Tiền mặt (Cash). 
    const cashOrders = selectedOrders.filter((o:  any) => o.payment_method === 'cash' && o.remittance_status === 'pending');
    
    // Tính tổng tiền mặt
    const totalCash = cashOrders.reduce((sum: number, o: any) => sum + (o.final_amount || 0), 0);

    // Cảnh báo nếu chọn nhầm đơn CK
    const hasTransfer = selectedOrders.some((o: any) => o.payment_method === 'transfer');

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
                        refresh(); 
                    }
                });
            } catch (error: any) {
                console.error(error);
                message.error(error.message || "Lỗi khi nộp tiền.");
            }
        }
    });
  };

  // 3. Columns Definition
  const columns = useMemo(() => [
    {
      title: 'Mã đơn',
      dataIndex: 'code',
      width: 140,
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
       title: 'Ngày tạo',
       dataIndex: 'created_at',
       width: 120,
       render: (d: string) => dayjs(d).format("DD/MM HH:mm"),
    },
    // [NEW] KHO XUẤT
    { 
        title: 'Kho xuất', 
        dataIndex: 'warehouse_name',
        width: 140,
        render: (t: string) => <Tag icon={<ShopOutlined />}>{t}</Tag>
    },
    // [NEW] NGƯỜI BÁN
    {
        title: 'Người bán',
        dataIndex: 'creator_name',
        width: 150,
        render: (name: string) => (
            <Space>
                <Avatar size="small" style={{backgroundColor:'#87d068'}} icon={<UserOutlined />} />
                <span style={{fontSize:12}}>{name}</span>
            </Space>
        )
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer_name',
      width: 200,
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
      width: 120,
      render: (val: number) => <Text strong>{val?.toLocaleString()} ₫</Text>,
    },
    {
      title: 'HTTT',
      dataIndex: 'payment_method',
      align: 'center' as const,
      width: 100,
      render: (val: string) => val === 'transfer' ? <Tag color="blue">CK</Tag> : <Tag color="orange">Tiền mặt</Tag>
    },
    {
      title: 'Nộp quỹ',
      dataIndex: 'remittance_status',
      align: 'center' as const,
      width: 120,
      render: (status: string) => {
          if(status === 'deposited') return <Tag color="success" icon={<CheckCircleOutlined />}>Đã vào quỹ</Tag>;
          if(status === 'confirming') return <Tag color="processing" icon={<SyncOutlined spin />}>Chờ duyệt</Tag>;
          if(status === 'skipped') return <Tag>Nợ (Không nộp)</Tag>;
          if(status === 'pending') return <Tag color="warning">Chưa nộp</Tag>;
          return <Tag>{status}</Tag>; 
      }
    },
    {
        title: "Hóa Đơn",
        key: "invoice_action",
        width: 120,
        align: "center" as const,
        render: (_: any, record: any) => (
            <VatActionButton 
                invoice={record.sales_invoice || { id: null, status: 'pending' }}
                // Filter & Map ID an toàn
                orderItems={(record.order_items || [])
                    .filter((i:any) => i.product_id) // Ensure product_id exists
                    .map((i: any) => ({
                        ...i,
                        // [FIX CRITICAL] Map id = product_id (BigInt) cho Modal kho
                        id: Number(i.product_id),
                        name: i.product?.name || i.product_name,
                        unit: i.uom || i.product?.retail_unit || 'Cái',
                        price: i.unit_price,
                        qty: i.quantity
                    }))}
                customer={{
                    name: record.customer_name,
                    phone: record.customer_phone,
                    tax_code: record.tax_code || '', 
                    email: record.customer_email || ''
                }}
                onUpdate={() => refresh()} 
            />
        )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: () => <Button type="text" icon={<PrinterOutlined />} />
    }
  ], []);

  // 4. Stat Items
  const statItems = [
    {
      title: "Tổng doanh số (Tháng)",
      value: `${(stats?.total_sales || 0).toLocaleString()} ₫`,
      color: "#1890ff",
      icon: <ShopOutlined />,
    },
    {
      title: "Tiền mặt chờ nộp (Toàn CH)",
      value: `${(stats?.total_cash_pending || 0).toLocaleString()} ₫`,
      color: "#cf1322",
      icon: <AlertOutlined />,
    },
    {
      title: "Chưa nộp (Của bạn)",
      value: `${pendingRevenue.toLocaleString()} ₫`,
      color: pendingRevenue > 0 ? "#faad14" : "#52c41a",
      icon: <BankOutlined />,
      subTitle: pendingRevenue > 0 ? '(Cần nộp ngay)' : '(Đã sạch nợ)'
    },
  ];

  return (
    <div style={{ padding: 8, background: "#e1e1dfff", minHeight: "100vh" }}>
       
       <StatHeader items={statItems} loading={tableProps.loading} />

       <FilterAction
        {...filterProps}
        searchPlaceholder="Tìm mã đơn, KH, SĐT, Sản phẩm..."
        filterValues={currentFilters}
        filters={[
          {
            key: "status",
            placeholder: "Trạng thái Đơn",
            options: [
                { label: 'Hoàn thành', value: 'COMPLETED' },
                { label: 'Đang giao', value: 'SHIPPING' },
                { label: 'Đã xác nhận', value: 'CONFIRMED' },
                { label: 'Đã hủy', value: 'CANCELLED' },
            ],
          },
          {
            key: "remittanceStatus",
            placeholder: "Trạng thái Nộp tiền",
            options: [
                { label: 'Chưa nộp', value: 'pending' },
                { label: 'Chờ duyệt', value: 'confirming' },
                { label: 'Đã nộp', value: 'deposited' },
            ],
          },
          // [NEW] Filter Kho xuất
          {
            key: "warehouseId",
            placeholder: "Kho xuất bán",
            options: warehouses.map(w => ({ label: w.name, value: w.id })),
          },
          // [NEW] Filter Payment Method
          { 
            key: 'paymentMethod', 
            placeholder: 'Hình thức TT', 
            options: [
                { label: 'Tiền mặt', value: 'cash' },
                { label: 'Chuyển khoản', value: 'transfer' },
                { label: 'Công nợ', value: 'debt' },
                { label: 'Thẻ / Khác', value: 'card' } // 'card' or others mapping to code if needed, assuming 'card' is value used in DB or mapped in code
            ] 
          },
          {
            key: "invoiceStatus",
            placeholder: "Trạng thái VAT",
            options: [
                { label: 'Đã xuất', value: 'exported' },
                { label: 'Chờ xuất', value: 'pending' },
                { label: 'Chưa yêu cầu', value: 'none' },
            ],
          },
          {
            key: "creatorId",
            placeholder: "Người bán",
            options: creators.map(u => ({ label: u.full_name || u.email, value: u.id })),
          }
        ]}
        actions={[
          {
            label: `Nộp tiền (${selectedRowKeys.length})`,
            icon: <BankOutlined />,
            onClick: handleRemitCash,
            type: "primary",
            danger: true,
            disabled: selectedRowKeys.length === 0
          }
        ]}
      />

      <SmartTable
        {...tableProps}
        columns={columns}
        emptyText="Chưa có đơn hàng POS nào"
        rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
            getCheckboxProps: (r: any) => ({
                // Vẫn chỉ cho chọn đơn chưa nộp
                disabled: r.remittance_status !== 'pending', 
            }),
        }}
      />
    </div>
  );
};

export default B2COrderListPage;