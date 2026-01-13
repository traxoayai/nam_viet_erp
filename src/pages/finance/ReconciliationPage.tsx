import { useState, useEffect } from 'react';
import { Card, Button, Upload, Table, Row, Col, Typography, Select, message } from 'antd';
import { UploadOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { supabase } from '@/shared/lib/supabaseClient';
import { parseBankStatement } from '@/shared/utils/bankStatementParser';
import { salesService } from '@/features/sales/api/salesService';

import { 
  PendingReconciliationOrder, 
  ReconciliationMatch, 
  FundAccount 
} from "@/features/finance/types/finance";

const { Title, Text } = Typography;

const ReconciliationPage = () => {
    const [pendingOrders, setPendingOrders] = useState<PendingReconciliationOrder[]>([]);
    const [matches, setMatches] = useState<ReconciliationMatch[]>([]); // Dữ liệu bảng kết quả
    const [loading, setLoading] = useState(false);
    const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
    const [selectedFundId, setSelectedFundId] = useState<number | null>(null);

    // 1. Load dữ liệu nền
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        // Load Orders
        const { data: orders } = await supabase.rpc('get_pending_reconciliation_orders');
        setPendingOrders(orders || []);
        
        // Load Quỹ
        const { data: funds } = await supabase.from('fund_accounts').select('*').eq('status', 'active');
        setFundAccounts(funds || []);
        if (funds?.[0]) setSelectedFundId(funds[0].id);
        setLoading(false);
    };

    // 2. Xử lý Upload & Matching
    const handleUpload = async (file: File) => {
        setLoading(true);
        try {
            const transactions = await parseBankStatement(file);
            
            // THUẬT TOÁN MATCHING
            const results: ReconciliationMatch[] = transactions.map((trans, index) => {
                // A. Tìm theo Mã đơn (SO-xxxx hoặc POS-xxxx) - Regex linh hoạt
                const codeMatch = trans.description.match(/(SO|POS|DH)[- ]?\d+/i);
                let matchedOrder: PendingReconciliationOrder | undefined;

                if (codeMatch) {
                    const extractedCode = codeMatch[0].replace(' ', '-').toUpperCase(); // Chuẩn hóa SO 123 -> SO-123
                    matchedOrder = pendingOrders.find(o => o.order_code.includes(extractedCode));
                }

                // B. Nếu chưa tìm thấy, tìm theo Mã KH (Nếu có)
                // if (!matchedOrder) { ... logic tìm theo customer_code ... }

                return {
                    key: index,
                    transaction: trans,
                    matched_order_id: matchedOrder?.order_id || null, // Default value cho Select
                    status: (matchedOrder ? 'matched' : 'unmatched') as 'matched' | 'unmatched'
                };
            }).filter(item => item.status === 'matched'); // Chỉ hiện các dòng khớp (hoặc bỏ filter để hiện hết)

            setMatches(results);
            if(results.length > 0) message.success(`Đã tìm thấy ${results.length} giao dịch khớp lệnh!`);
            else message.warning("Không tìm thấy giao dịch nào khớp với đơn hàng treo.");

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
        
        // Lọc ra các dòng có đơn hàng được chọn
        const orderIds = matches
            .map(m => m.matched_order_id)
            .filter((id): id is string => id !== null);

        if (orderIds.length === 0) return message.warning("Không có đơn hàng nào để đối soát.");

        try {
            setLoading(true);
            // Gọi API confirm_order_payment (Đã update ở task trước)
            await salesService.confirmPayment(orderIds, selectedFundId);
            
            message.success(`Đã đối soát thành công ${orderIds.length} đơn hàng!`);
            setMatches([]); // Clear bảng
            loadData(); // Reload pending orders
        } catch (err: any) {
            message.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Columns cho bảng kết quả
    const columns = [
        {
            title: 'Nội dung Sao kê (Ngân hàng)',
            dataIndex: ['transaction', 'description'], // [FIX] Truy cập nested object
            width: '40%',
            render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>
        },
        {
            title: <SwapOutlined />, 
            width: '50px', 
            render: () => <SwapOutlined style={{ color: '#1890ff' }} /> 
        },
        {
            title: 'Đơn hàng Đối ứng (Hệ thống)',
            dataIndex: 'matched_order_id',
            width: '40%',
            render: (val: string, record: any) => (
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Chọn đơn hàng..."
                    optionFilterProp="children"
                    value={val}
                    onChange={(newVal) => {
                        // Cập nhật lại state matches khi user chọn thủ công
                        const newMatches = [...matches];
                        const index = newMatches.findIndex(m => m.key === record.key);
                        newMatches[index].matched_order_id = newVal;
                        setMatches(newMatches);
                    }}
                >
                    {pendingOrders.map(o => (
                        <Select.Option key={o.order_id} value={o.order_id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span><b>{o.order_code}</b> - {o.customer_name}</span>
                                <span style={{ color: 'green' }}>
                                    {new Intl.NumberFormat('vi-VN').format(o.remaining_amount)}đ
                                </span>
                            </div>
                        </Select.Option>
                    ))}
                </Select>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={3}>Đối soát Giao dịch Ngân hàng</Title>
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={16} align="middle">
                    <Col span={8}>
                        <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls,.pdf">
                            <Button type="primary" icon={<UploadOutlined />} size="large" loading={loading}>
                                Upload Sao kê (Excel/PDF)
                            </Button>
                        </Upload>
                    </Col>
                    <Col span={8}>
                        <Select 
                            style={{ width: '100%' }} 
                            placeholder="Chọn Quỹ nhận tiền (VD: VCB)"
                            size="large"
                            value={selectedFundId}
                            onChange={setSelectedFundId}
                            options={fundAccounts.map(f => ({ label: f.name, value: f.id }))}
                        />
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                        <Button 
                            type="primary" 
                            danger 
                            icon={<CheckCircleOutlined />} 
                            size="large"
                            onClick={handleConfirmReconciliation}
                            disabled={matches.length === 0}
                        >
                            Xác nhận Đối soát ({matches.filter(m => m.matched_order_id).length})
                        </Button>
                    </Col>
                </Row>
            </Card>

            <Row gutter={16}>
                <Col span={24}>
                    <Table 
                        dataSource={matches} 
                        columns={columns} 
                        pagination={false}
                        locale={{ emptyText: 'Chưa có dữ liệu. Hãy upload file sao kê.' }}
                        title={() => <b>Kết quả Khớp lệnh Tự động</b>}
                    />
                </Col>
            </Row>
            
            <div style={{ marginTop: 24 }}>
                <Title level={5}>Danh sách Đơn hàng Treo (Chờ thanh toán): {pendingOrders.length}</Title>
                {/* Có thể hiển thị list pending ở đây để tham khảo */}
            </div>
        </div>
    );
};

export default ReconciliationPage;
