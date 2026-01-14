import { useState, useEffect } from 'react';
import { Card, Button, Upload, Table, Row, Col, Typography, Select, message, Tag, Input, Space } from 'antd';
import { UploadOutlined, CheckCircleOutlined, SwapOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseBankStatement } from '@/shared/utils/bankStatementParser';
import { salesService } from '@/features/sales/api/salesService';
import dayjs from 'dayjs';

import { 
  PendingReconciliationOrder, 
  ReconciliationMatch, 
  FundAccount 
} from "@/features/finance/types/finance";

const { Title, Text } = Typography;

const ReconciliationPage = () => {
    const [pendingOrders, setPendingOrders] = useState<PendingReconciliationOrder[]>([]);
    const [matches, setMatches] = useState<ReconciliationMatch[]>([]); 
    const [loading, setLoading] = useState(false);
    const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
    const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState(''); // Tìm kiếm đơn treo

    // 1. Load dữ liệu nền
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: orders } = await supabase.rpc('get_pending_reconciliation_orders');
        setPendingOrders(orders || []);
        
        const { data: funds } = await supabase.from('fund_accounts').select('*').eq('status', 'active');
        setFundAccounts(funds || []);
        if (funds?.[0]) setSelectedFundId(funds[0].id);
        setLoading(false);
    };

    // 2. Xử lý Upload & Matching (Logic giữ nguyên, chỉ update UI)
    const handleUpload = async (file: File) => {
        setLoading(true);
        try {
            const transactions = await parseBankStatement(file);
            
            const results: ReconciliationMatch[] = transactions.map((trans, index) => {
                // Logic Matching (Copy lại từ code cũ)
                const codeMatch = trans.description.match(/(SO|POS|DH)[- ]?\d+/i);
                let matchedOrder: PendingReconciliationOrder | undefined;

                if (codeMatch) {
                    const extractedCode = codeMatch[0].replace(' ', '-').toUpperCase();
                    matchedOrder = pendingOrders.find(o => o.order_code.includes(extractedCode));
                }

                // Fuzzy Match (Customer Code & Amount)
                if (!matchedOrder) {
                    matchedOrder = pendingOrders.find(o => {
                         if (!o.customer_code || o.customer_code === 'N/A') return false;
                         const cleanDesc = trans.description.toUpperCase();
                         const cleanCusCode = o.customer_code.toUpperCase();
                         const isAmountMatch = Math.abs(trans.amount - o.remaining_amount) < 1000;
                         return cleanDesc.includes(cleanCusCode) && isAmountMatch;
                    });
                }

                return {
                    key: index,
                    transaction: trans,
                    matched_order_id: matchedOrder?.order_id || null,
                    status: (matchedOrder ? 'matched' : 'unmatched') as 'matched' | 'unmatched'
                };
            });
            // Hiển thị TẤT CẢ giao dịch đọc được (kể cả chưa khớp) để user tự chọn
            setMatches(results); 
            if(results.length > 0) message.success(`Đã đọc được ${results.length} giao dịch từ sao kê.`);
            
        } catch (err: any) {
            message.error("Lỗi đọc file: " + err.message);
        } finally {
            setLoading(false);
        }
        return false;
    };

    // 3. Submit
    const handleConfirmReconciliation = async () => {
        if (!selectedFundId) return message.error("Chưa chọn Quỹ nhận tiền!");
        const orderIds = matches.map(m => m.matched_order_id).filter((id): id is string => id !== null);
        if (orderIds.length === 0) return message.warning("Chưa ghép đôi đơn hàng nào.");

        try {
            setLoading(true);
            await salesService.confirmPayment(orderIds, selectedFundId);
            message.success(`Đã đối soát thành công ${orderIds.length} đơn hàng!`);
            setMatches([]);
            loadData(); 
        } catch (err: any) {
            message.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- COLUMNS CONFIG ---

    // Bảng 1: Kết quả Đối soát (Bên Trái)
    const matchColumns = [
        {
            title: 'Giao dịch Ngân hàng (Sao kê)',
            dataIndex: ['transaction'],
            width: '45%',
            render: (trans: any) => (
                <div>
                    <div style={{ fontWeight: 500, color: '#1890ff' }}>{trans.date || 'N/A'} - {new Intl.NumberFormat('vi-VN').format(trans.amount)}đ</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{trans.description}</div>
                </div>
            )
        },
        {
            title: <SwapOutlined />, 
            width: 40, 
            align: 'center' as const,
            render: () => <SwapOutlined style={{ color: '#faad14' }} /> 
        },
        {
            title: 'Ghép đơn hàng',
            dataIndex: 'matched_order_id',
            width: '45%',
            render: (val: string, record: any) => (
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Chọn đơn..."
                    optionFilterProp="children"
                    value={val}
                    onChange={(newVal) => {
                        const newMatches = [...matches];
                        const index = newMatches.findIndex(m => m.key === record.key);
                        newMatches[index].matched_order_id = newVal;
                        setMatches(newMatches);
                    }}
                    status={!val ? 'warning' : ''}
                >
                    {pendingOrders.map(o => (
                        <Select.Option key={o.order_id} value={o.order_id}>
                            <b>{o.order_code}</b> - {new Intl.NumberFormat('vi-VN').format(o.remaining_amount)}đ ({o.customer_name})
                        </Select.Option>
                    ))}
                </Select>
            )
        }
    ];

    // Bảng 2: Danh sách Đơn treo (Bên Phải)
    const pendingColumns = [
        {
            title: 'Mã đơn',
            dataIndex: 'order_code',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Khách hàng',
            dataIndex: 'customer_name',
            render: (text: string, record: any) => (
                <div>
                    <div>{text}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{dayjs(record.created_at).format('DD/MM HH:mm')}</div>
                </div>
            )
        },
        {
            title: 'Cần thu',
            dataIndex: 'remaining_amount',
            align: 'right' as const,
            render: (val: number) => <Text strong style={{ color: '#cf1322' }}>{new Intl.NumberFormat('vi-VN').format(val)}</Text>
        }
    ];

    // Filter Đơn treo theo Search
    const filteredPendingOrders = pendingOrders.filter(o => 
        o.order_code.toLowerCase().includes(searchText.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchText.toLowerCase()) ||
        String(o.remaining_amount).includes(searchText)
    );

    return (
        <div style={{ padding: 24, minHeight: '100vh', background: '#f0f2f5' }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                    <Title level={3} style={{ margin: 0 }}>Đối soát Giao dịch</Title>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                    <Space>
                        <Select 
                            style={{ width: 200 }} 
                            placeholder="Chọn Quỹ nhận tiền"
                            value={selectedFundId}
                            onChange={setSelectedFundId}
                            options={fundAccounts.map(f => ({ label: f.name, value: f.id }))}
                        />
                        <Button 
                            type="primary" 
                            size="large"
                            icon={<CheckCircleOutlined />} 
                            onClick={handleConfirmReconciliation}
                            disabled={matches.length === 0}
                        >
                            Xác nhận ({matches.filter(m => m.matched_order_id).length})
                        </Button>
                    </Space>
                </Col>
            </Row>

            <Row gutter={24}>
                {/* CỘT 1: KHU VỰC MATCHING (SAO KÊ) */}
                <Col span={14}>
                    <Card 
                        title={
                            <Space>
                                <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls,.pdf">
                                    <Button icon={<UploadOutlined />} type="primary" loading={loading}>Upload Sao kê</Button>
                                </Upload>
                                <Text type="secondary" style={{ fontSize: 12 }}>Hỗ trợ PDF, Excel</Text>
                            </Space>
                        }
                        style={{ height: '100%' }}
                        bodyStyle={{ padding: 0 }}
                    >
                        <Table 
                            dataSource={matches} 
                            columns={matchColumns} 
                            pagination={false}
                            scroll={{ y: 600 }}
                            locale={{ emptyText: 'Chưa có dữ liệu sao kê. Hãy upload file.' }}
                            rowKey="key"
                        />
                    </Card>
                </Col>

                {/* CỘT 2: DANH SÁCH ĐƠN TREO (REFERENCE) */}
                <Col span={10}>
                    <Card 
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Đơn hàng Treo ({pendingOrders.length})</span>
                                <Input 
                                    prefix={<SearchOutlined />} 
                                    placeholder="Tìm mã, khách, tiền..." 
                                    style={{ width: 180 }}
                                    onChange={e => setSearchText(e.target.value)}
                                />
                            </div>
                        }
                        style={{ height: '100%' }}
                        bodyStyle={{ padding: 0 }}
                        extra={<Tag color="orange">Chưa thanh toán</Tag>}
                    >
                        <Table 
                            dataSource={filteredPendingOrders} 
                            columns={pendingColumns} 
                            pagination={{ pageSize: 10, size: 'small' }}
                            rowKey="order_id"
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ReconciliationPage;
