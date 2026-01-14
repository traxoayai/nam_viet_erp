// src/pages/purchasing/PurchaseOrderMasterPage.tsx
import React, { useState } from 'react';
import { Layout, Typography } from 'antd';
// import { HomeOutlined } from '@ant-design/icons';
import { usePurchaseOrderMaster } from '../../features/purchasing/hooks/usePurchaseOrderMaster';
import { LogisticsStatsWidget } from '../../features/purchasing/components/LogisticsStatsWidget';
import { PurchaseOrderFilters } from '../../features/purchasing/components/PurchaseOrderFilters';
import { PurchaseOrderTable } from '../../features/purchasing/components/PurchaseOrderTable';
import { PurchaseOrderMaster } from '../../features/purchasing/types/purchase';
import { FinanceFormModal } from '../../pages/finance/components/FinanceFormModal';

const { Content } = Layout;
const { Title } = Typography;

const PurchaseOrderMasterPage: React.FC = () => {
    // 1. KẾT NỐI VỚI HOOK (BRAIN)
    const { 
        orders, 
        logisticsStats, 
        loading, 
        pagination, 
        setPagination, 
        filters, 
        setFilters, 
        deleteOrder, 
        autoCreate,
        fetchOrders
    } = usePurchaseOrderMaster();

    // --- STATE CHO MODAL THANH TOÁN (Phiên bản mới) ---
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderMaster | null>(null);

    // Hàm mở Modal (Callback từ bảng)
    const handleOpenPayment = (order: PurchaseOrderMaster) => {
        setSelectedOrder(order);
        setPaymentModalVisible(true);
    };

    // Khi đóng modal thành công hoặc hủy
    const handlePaymentModalClose = () => {
        setPaymentModalVisible(false);
        setSelectedOrder(null);
        // Refresh lại bảng để cập nhật trạng thái nếu có (Tuy nhiên modal tạo TRANSACTION pending, có thể chưa update ngay PO)
        // Nhưng tốt nhất vẫn nên fetch lại
        fetchOrders(); 
    };

    return (
        <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
            <Content style={{ padding: "12px" }}>
                
                {/* 2. HEADER NAV */}
                <div style={{ marginBottom: 16 }}>
                    <Title level={3} style={{ marginTop: 6 }}>Quản Lý Đơn Mua Hàng</Title>
                </div>

                {/* 3. WIDGET THỐNG KÊ LOGISTICS */}
                <LogisticsStatsWidget stats={logisticsStats} />

                {/* 4. THANH CÔNG CỤ & BỘ LỌC */}
                <PurchaseOrderFilters 
                    filters={filters} 
                    setFilters={setFilters} 
                    onAutoCreate={autoCreate} 
                />

                {/* 5. DANH SÁCH DỮ LIỆU */}
                <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
                    <PurchaseOrderTable 
                        orders={orders} 
                        loading={loading} 
                        pagination={{
                            current: pagination.page,
                            pageSize: pagination.pageSize,
                            total: pagination.total
                        }} 
                        setPagination={setPagination} 
                        onDelete={deleteOrder} 
                        onOpenPaymentModal={handleOpenPayment} 
                    />
                </div>

                {/* 6. MODAL THANH TOÁN (Chuẩn Finance) */}
                {paymentModalVisible && selectedOrder && (
                    <FinanceFormModal
                        open={paymentModalVisible}
                        onCancel={handlePaymentModalClose}
                        initialFlow="out" // Chi tiền
                        initialValues={{
                            business_type: 'trade', 
                            partner_type: 'supplier',
                            supplier_id: selectedOrder.supplier_id,
                            partner_name: selectedOrder.supplier_name,
                            amount: (selectedOrder.final_amount || 0) - (selectedOrder.total_paid || 0),
                            description: `Thanh toán đơn hàng ${selectedOrder.code}`,
                            ref_type: 'purchase_order',
                            ref_id: selectedOrder.id
                        }}
                    />
                )}

            </Content>
        </Layout>
    );
};

export default PurchaseOrderMasterPage;
