// src/features/purchasing/components/PurchaseOrderFilters.tsx
import React, { useState } from 'react';
import { Row, Col, Input, DatePicker, Select, Button, Space } from 'antd';
import { SyncOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface PurchaseOrderFiltersProps {
    filters: {
        search?: string;
        status?: string;
        dateRange?: [string, string];
    };
    setFilters: (filters: any) => void;
    onAutoCreate: () => void;
}

export const PurchaseOrderFilters: React.FC<PurchaseOrderFiltersProps> = React.memo(({ filters, setFilters, onAutoCreate }) => {
    const navigate = useNavigate();
    const [localSearch, setLocalSearch] = useState(filters.search || '');

    const handleSearch = () => {
        setFilters({ ...filters, search: localSearch });
    };

    const handleDateChange = (dates: any, dateStrings: [string, string]) => {
        setFilters({ ...filters, dateRange: dates ? dateStrings : undefined });
    };

    const handleStatusChange = (value: string) => {
        setFilters({ ...filters, status: value });
    };

    return (
        <div style={{ marginBottom: 16, background: '#fff', padding: 16, borderRadius: 8 }}>
            <Row gutter={[16, 16]} align="middle">
                {/* FILTER INPUTS */}
                <Col flex="auto">
                    <Space wrap>
                        <Input
                            placeholder="Tìm theo Mã PO, NCC..."
                            prefix={<SearchOutlined />}
                            style={{ width: 250 }}
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onPressEnter={handleSearch}
                            allowClear
                        />
                        <RangePicker 
                            onChange={handleDateChange} 
                            format="DD/MM/YYYY"
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                        <Select
                            placeholder="Trạng thái"
                            style={{ width: 150 }}
                            allowClear
                            onChange={handleStatusChange}
                            value={filters.status}
                        >
                            <Option value="new">Mới tạo</Option>
                            <Option value="approved">Đã duyệt</Option>
                            <Option value="ordering">Đang đặt hàng</Option>
                            <Option value="partial">Giao một phần</Option>
                            <Option value="delivered">Đã giao đủ</Option>
                            <Option value="unpaid">Chưa thanh toán</Option>
                            <Option value="paid">Đã thanh toán</Option>
                            <Option value="cancelled">Đã hủy</Option>
                        </Select>
                    </Space>
                </Col>

                {/* ACTIONS */}
                <Col>
                    <Space>
                        <Button 
                            icon={<SyncOutlined />} 
                            onClick={onAutoCreate}
                        >
                            Tạo Dự trù (Min/Max)
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={() => navigate('/purchase-orders/new')}
                        >
                            Tạo Đơn Lẻ
                        </Button>
                    </Space>
                </Col>
            </Row>
        </div>
    );
});
