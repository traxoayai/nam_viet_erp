//src/features/inventory/components/ProductCardexModal.tsx
import { Modal, Table, Tag, DatePicker, Space } from "antd";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { inventoryService, ProductCardexItem } from "../api/inventoryService";

interface Props {
    visible: boolean;
    onClose: () => void;
    productId: number | null;
    productName: string;
    warehouseId: number; // Mặc định kho hiện tại
}

export const ProductCardexModal = ({ visible, onClose, productId, productName, warehouseId }: Props) => {
    const [data, setData] = useState<ProductCardexItem[]>([]);
    const [loading, setLoading] = useState(false);
    // Mặc định xem 30 ngày gần nhất
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(30, 'day'), 
        dayjs()
    ]);

    useEffect(() => {
        if (visible && productId) {
            fetchCardex();
        }
    }, [visible, productId, dateRange]);

    const fetchCardex = async () => {
        if (!productId) return;
        setLoading(true);
        try {
            const res = await inventoryService.getProductCardex(
                productId,
                warehouseId,
                dateRange[0].toISOString(),
                dateRange[1].toISOString()
            );
            setData(res);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Ngày GD',
            dataIndex: 'transaction_date',
            render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm')
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            render: (type: string, record: any) => (
                <Tag color={type === 'in' ? 'green' : 'red'}>
                    {type === 'in' ? 'NHẬP' : 'XUẤT'} ({record.business_type})
                </Tag>
            )
        },
        {
            title: 'Số lượng',
            dataIndex: 'quantity',
            render: (q: number, record: any) => (
                <span style={{ color: record.type === 'in' ? 'green' : 'red', fontWeight: 'bold' }}>
                    {record.type === 'in' ? '+' : '-'}{q}
                </span>
            )
        },
        {
            title: 'Chứng từ',
            dataIndex: 'ref_code',
            render: (code: string) => code ? <Tag>{code}</Tag> : '-'
        },
        {
            title: 'Đối tác',
            dataIndex: 'partner_name',
        },
        {
            title: 'Người thực hiện',
            dataIndex: 'created_by_name',
            render: (name: string) => <span style={{fontSize: 12}}>{name}</span>
        }
    ];

    return (
        <Modal 
            title={`Thẻ kho: ${productName}`} 
            open={visible} 
            onCancel={onClose}
            footer={null}
            width={900}
        >
            <div style={{marginBottom: 16}}>
                <Space>
                    <span>Thời gian:</span>
                    <DatePicker.RangePicker 
                        value={dateRange}
                        onChange={(val) => val && setDateRange([val[0]!, val[1]!])}
                        allowClear={false}
                    />
                </Space>
            </div>
            
            <Table 
                dataSource={data} 
                columns={columns} 
                rowKey={(r) => r.transaction_date + r.ref_code} // Composite Key tạm
                loading={loading}
                pagination={{ pageSize: 10 }}
                size="small"
            />
        </Modal>
    );
};
