// src/features/purchasing/components/PurchaseOrderTable.tsx
import React from 'react';
import { Table, Tag, Button, Space, Progress, Popconfirm, Tooltip, Badge } from 'antd';
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
            width: 120, // Giảm width
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
            width: 180,
            ellipsis: true,
        },
        // [NEW] Logistics
        {
            title: 'Logistics',
            key: 'logistics',
            width: 180,
            render: (_: any, r: PurchaseOrderMaster) => (
                <div>
                    {r.carrier_name ? (
                        <>
                            <div style={{ fontWeight: 500 }}>{r.carrier_name}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                                {r.total_packages ? `${r.total_packages} kiện` : ''} 
                                {r.carrier_phone ? ` - ${r.carrier_phone}` : ''}
                            </div>
                        </>
                    ) : (
                        <span style={{ color: '#ccc' }}>---</span>
                    )}
                </div>
            )
        },
        // [NEW] Dự kiến về
        {
            title: 'Dự kiến về',
            key: 'delivery',
            width: 140,
            render: (_: any, r: PurchaseOrderMaster) => {
                if (!r.expected_delivery_date) return <span style={{ color: '#ccc' }}>---</span>;
                return (
                    <div>
                        <div style={{ fontWeight: 500 }}>
                            {dayjs(r.expected_delivery_date).format('DD/MM/YYYY')}
                        </div>
                        {r.expected_delivery_time && (
                             <div style={{ fontSize: 12, color: '#1677ff' }}>
                                {r.expected_delivery_time}
                             </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Tổng Tiền',
            dataIndex: 'final_amount',
            key: 'final_amount',
            align: 'right',
            width: 120,
            render: (value: number) => formatCurrency(value),
        },
        // [NEW] Thanh toán (Progress)
        {
            title: 'Thanh toán',
            key: 'payment',
            width: 160,
            render: (_: any, r: PurchaseOrderMaster) => {
                const total = r.final_amount || 0;
                const paid = r.total_paid || 0;
                const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
                
                let statusColor = '#d9d9d9'; // Default grey
                let statusText = 'UNPAID';

                if (r.payment_status === 'paid' || percent >= 100) {
                    statusColor = '#52c41a';
                    statusText = 'PAID';
                } else if (paid > 0) {
                    statusColor = '#faad14';
                    statusText = 'PARTIAL';
                }

                return (
                    <Tooltip title={`Đã trả: ${formatCurrency(paid)} / ${formatCurrency(total)}`}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                <Badge color={statusColor as any} text={statusText} />
                                <span>{percent}%</span>
                            </div>
                            <Progress percent={percent} showInfo={false} size="small" strokeColor={statusColor} />
                        </div>
                    </Tooltip>
                );
            }
        },
        // Cột Tiến độ Giao hàng (Giữ nguyên hoặc tinh chỉnh)
        {
            title: 'Tiến độ',
            dataIndex: 'delivery_progress',
            key: 'delivery_progress',
            width: 100,
            render: (progress: number) => {
                const percent = progress || 0;
                let color = '#1890ff';
                if (percent >= 100) color = '#52c41a';
                return (
                    <Tooltip title={`${percent}%`}>
                        <Progress 
                            percent={Math.min(percent, 100)} 
                            steps={5}
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
            width: 100,
            render: (status: string) => {
                let color = 'default';
                let label = status;

                switch (status) {
                    case 'new': color = 'blue'; label = 'Mới'; break;
                    case 'approved': color = 'cyan'; label = 'Duyệt'; break;
                    case 'ordering': color = 'orange'; label = 'Đang đặt'; break;
                    case 'completed': color = 'green'; label = 'Xong'; break;
                    case 'cancelled': color = 'red'; label = 'Hủy'; break;
                }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 80,
            align: 'center',
            fixed: 'right',
            render: (_: any, record: PurchaseOrderMaster) => (
                <Space size="small">
                    <Tooltip title="Xem chi tiết">
                        <Link to={`/purchase-orders/${record.id}`}>
                            <Button type="text" size="small" icon={<EyeOutlined />} />
                        </Link>
                    </Tooltip>
                    
                    <Popconfirm
                        title="Xóa đơn?"
                        onConfirm={() => onDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
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
