// src/pages/purchasing/PurchaseOrderMasterPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom"; // Adding hook
import { purchaseOrderService } from '../../features/purchasing/api/purchaseOrderService';
import { Layout, Typography, App } from 'antd';
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

    const { message } = App.useApp();
    const navigate = useNavigate();
    const [cloningId, setCloningId] = useState<number | null>(null); // State loading cục bộ cho từng dòng

    // [NEW] Auto-refresh when window gets focus (e.g. Back from Detail)
    useEffect(() => {
        const onFocus = () => {
            fetchOrders();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [fetchOrders]);

    // --- STATE CHO MODAL THANH TOÁN (Phiên bản mới) ---
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderMaster | null>(null);

    // [LOGIC] Hàm xử lý sao chép
    const handleCloneOrder = async (order: PurchaseOrderMaster) => {
        setCloningId(order.id); // Bật loading
        try {
            // 1. Lấy chi tiết đơn cũ
            const detail = await purchaseOrderService.getPODetail(order.id);
            if (!detail) throw new Error("Không tải được dữ liệu gốc");
    
            // 2. Chuẩn bị Payload (Làm sạch dữ liệu)
            const clonePayload = {
                supplier_id: detail.supplier_id,
                expected_date: null, // Reset ngày
                note: `Sao chép từ đơn ${detail.code}`,
                delivery_method: detail.delivery_method,
                shipping_partner_id: detail.shipping_partner_id,
                shipping_fee: detail.shipping_fee,
                status: 'DRAFT', // Bắt buộc về nháp
                
                // Map lại items, bỏ ID cũ
                items: (detail.items || []).map((i: any) => ({
                    product_id: i.product_id,
                    quantity: i.quantity_ordered,
                    unit_price: i.unit_price,
                    unit: i.uom_ordered || i.unit,
                    is_bonus: i.is_bonus
                }))
            };
    
            // 3. Gọi API Tạo mới
            const res = await purchaseOrderService.createPO(clonePayload as any);
            
            // 4. Thông báo & Chuyển trang
            message.success("Sao chép thành công!");
            const newId = res.id || res;
            navigate(`/purchase-orders/${newId}`);
    
        } catch (error: any) {
            message.error("Lỗi sao chép: " + error.message);
        } finally {
            setCloningId(null); // Tắt loading
        }
    };

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
                        loading={loading || (cloningId !== null)} 
                        pagination={{
                            current: pagination.page,
                            pageSize: pagination.pageSize,
                            total: pagination.total
                        }} 
                        setPagination={setPagination} 
                        onDelete={deleteOrder} 
                        onOpenPaymentModal={handleOpenPayment} 
                        onClone={handleCloneOrder}
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
