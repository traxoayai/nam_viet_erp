// src/pages/purchasing/PurchaseOrderMasterPage.tsx
import React from 'react';
import { Layout, Breadcrumb, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { usePurchaseOrderMaster } from '../../features/purchasing/hooks/usePurchaseOrderMaster';
import { LogisticsStatsWidget } from '../../features/purchasing/components/LogisticsStatsWidget';
import { PurchaseOrderFilters } from '../../features/purchasing/components/PurchaseOrderFilters';
import { PurchaseOrderTable } from '../../features/purchasing/components/PurchaseOrderTable';

const { Content } = Layout;
const { Title } = Typography;

const PurchaseOrderMasterPage: React.FC = () => {
    // 1. KẾT NỐI VỚI HOOK (BRAIN)
    // Toàn bộ logic, state, và api calls được lấy từ hook usePurchaseOrderMaster
    const { 
        orders, 
        logisticsStats, 
        loading, 
        pagination, 
        setPagination, 
        filters, 
        setFilters, 
        deleteOrder, 
        autoCreate 
    } = usePurchaseOrderMaster();

    return (
        <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
            <Content style={{ padding: "12px" }}>
                
                {/* 2. HEADER NAV */}
                <div style={{ marginBottom: 16 }}>
                    <Breadcrumb items={[
                        { title: <HomeOutlined /> }, 
                        { title: "Mua Hàng" }, 
                        { title: "Đơn Mua Hàng (PO)" }
                    ]} />
                    <Title level={3} style={{ marginTop: 8 }}>Quản Lý Đơn Mua Hàng</Title>
                </div>

                {/* 3. WIDGET THỐNG KÊ LOGISTICS */}
                {/* Truyền dữ liệu thống kê realtime từ hook vào UI */}
                <LogisticsStatsWidget stats={logisticsStats} />

                {/* 4. THANH CÔNG CỤ & BỘ LỌC */}
                {/* Xử lý tương tác tìm kiếm, lọc và gọi action tạo đơn */}
                <PurchaseOrderFilters 
                    filters={filters} 
                    setFilters={setFilters} 
                    onAutoCreate={autoCreate} 
                />

                {/* 5. DANH SÁCH DỮ LIỆU */}
                {/* Hiển thị bảng dữ liệu chính với logic loading và phân trang từ hook */}
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
                    />
                </div>

            </Content>
        </Layout>
    );
};

export default PurchaseOrderMasterPage;
