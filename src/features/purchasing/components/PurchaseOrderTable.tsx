// src/features/purchasing/components/PurchaseOrderTable.tsx
import React from 'react';
import { Table, Tag, Button, Space, Progress, Popconfirm, Tooltip } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { PurchaseOrderMaster } from '../types/purchase';
import { formatCurrency } from '@/shared/utils/format';

interface PurchaseOrderTableProps {
    orders: PurchaseOrderMaster[];
    loading: boolean;
    pagination: {
        current: number;
        pageSize: number;
        total: number;
    };
    setPagination: (pagination: any) => void;
    onDelete: (id: number) => void;
}

export const PurchaseOrderTable: React.FC<PurchaseOrderTableProps> = React.memo(({ orders, loading, pagination, setPagination, onDelete }) => {

    const columns: any[] = [
        {
            title: 'Mã Đơn',
            dataIndex: 'code',
            key: 'code',
            render: (text: string, record: PurchaseOrderMaster) => (
                <Link to={`/purchase-orders/${record.id}`} style={{ fontWeight: 600 }}>
                    {text}
                </Link>
            ),
        },
        {
            title: 'Nhà Cung Cấp',
            dataIndex: 'supplier_name',
            key: 'supplier_name',
            width: 200,
            ellipsis: true,
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 120,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
        },
        {
            title: 'Tổng Tiền',
            dataIndex: 'final_amount',
            key: 'final_amount',
            align: 'right',
            width: 150,
            render: (value: number) => formatCurrency(value),
        },
        {
            title: 'Tiến độ Giao',
            dataIndex: 'delivery_progress',
            key: 'delivery_progress',
            width: 180,
            render: (progress: number) => {
                const percent = progress || 0;
                let status: 'success' | 'active' | 'exception' | 'normal' = 'active';
                let color = '#1890ff';

                if (percent >= 100) {
                    status = 'success';
                    color = '#52c41a';
                }
                // Handle over-delivery
                if (percent > 100) {
                    color = '#722ed1'; // Purple
                }

                return (
                    <Tooltip title={`${percent}%`}>
                        <Progress 
                            percent={Math.min(percent, 100)} 
                            status={status} 
                            strokeColor={color}
                            size="small"
                        />
                    </Tooltip>
                );
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => {
                let color = 'default';
                let label = status;

                switch (status) {
                    case 'new': color = 'blue'; label = 'Mới tạo'; break;
                    case 'approved': color = 'cyan'; label = 'Đã duyệt'; break;
                    case 'ordering': color = 'orange'; label = 'Đang đặt'; break;
                    case 'completed': color = 'green'; label = 'Hoàn tất'; break;
                    case 'cancelled': color = 'red'; label = 'Đã hủy'; break;
                }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 100,
            align: 'center',
            render: (_: any, record: PurchaseOrderMaster) => (
                <Space size="middle">
                    <Tooltip title="Xem chi tiết">
                        <Link to={`/purchase-orders/${record.id}`}>
                            <Button type="text" icon={<EyeOutlined />} />
                        </Link>
                    </Tooltip>
                    
                    <Popconfirm
                        title="Bạn có chắc muốn xóa đơn này không?"
                        onConfirm={() => onDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        }
    ];

    const handleTableChange = (newPagination: any) => {
        setPagination({
            page: newPagination.current,
            pageSize: newPagination.pageSize,
            total: pagination.total
        });
    };

    return (
        <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `Tổng ${total} đơn`
            }}
            onChange={handleTableChange}
            size="middle"
            scroll={{ x: 1000 }}
        />
    );
});
