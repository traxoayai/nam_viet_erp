import React from 'react';
import { Table, Avatar, Tag, InputNumber, Button, Typography, Tooltip, Badge } from 'antd';
import { DeleteOutlined, InfoCircleOutlined, ShopOutlined } from '@ant-design/icons';
import { TransferCartItem } from '@/features/inventory/types/transfer';

const { Text } = Typography;

interface TransferProductTableProps {
  items: TransferCartItem[];
  onChangeQuantity: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
}

const TransferProductTable: React.FC<TransferProductTableProps> = ({ 
  items, 
  onChangeQuantity, 
  onRemove 
}) => {
  const columns = [
    {
      title: 'Sản phẩm',
      dataIndex: 'product_id',
      key: 'product',
      width: 350,
      render: (_: any, record: TransferCartItem) => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <Badge count={record.lot_hint ? "Lô cũ" : 0} dot offset={[-5, 5]} color="cyan">
                 <Avatar 
                    src={record.image_url} 
                    shape="square" 
                    size={48} 
                    icon={<ShopOutlined />}
                 />
             </Badge>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <Text strong style={{ fontSize: 14 }}>{record.product_name}</Text>
                 <Space size={4}>
                     <Text type="secondary" style={{ fontSize: 12 }}>{record.sku}</Text>
                     {record.lot_hint && (
                        <Tooltip title={`Gợi ý xuất lô ${record.lot_hint} (HSD: ${record.expiry_hint || 'N/A'})`}>
                            <Tag color="blue" bordered={false} style={{ fontSize: 10 }}>FeFo</Tag>
                        </Tooltip>
                     )}
                 </Space>
             </div>
        </div>
      )
    },
    {
      title: (
        <Tooltip title="Vị trí trong kho (Shelf Location)">
           Vị trí <InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: 'shelf_location',
      key: 'shelf_location',
      width: 120,
      render: (text: string) => text ? <Tag>{text}</Tag> : <Text type="secondary" italic>--</Text>
    },
    {
      title: 'Tồn kho (ĐVCB)',
      dataIndex: 'current_stock',
      key: 'stock',
      width: 120,
      render: (val: number) => <Text>{Number(val).toLocaleString()}</Text>
    },
    {
      title: 'Đơn vị chuyển',
      dataIndex: 'unit',
      key: 'unit',
      width: 120,
      render: (text: string) => <Tag color="geekblue">{text}</Tag>
    },
    {
      title: 'Số lượng chuyển',
      key: 'quantity',
      width: 150,
      render: (_: any, record: TransferCartItem) => (
          <Tooltip title={record.error} open={!!record.error}>
             <InputNumber
                min={1}
                status={record.error ? 'error' : ''}
                value={record.quantity}
                onChange={(val) => onChangeQuantity(record.key, val || 1)}
                style={{ width: '100%' }}
             />
          </Tooltip>
      )
    },
    {
      title: 'Quy đổi (ĐVCB)',
      key: 'base_total',
      width: 150,
      render: (_: any, record: TransferCartItem) => (
          <div>
              <Text strong>{Number(record.base_quantity).toLocaleString()}</Text>
              <div style={{ fontSize: 11, color: '#999' }}>
                 (1 {record.unit} = {record.conversion_factor})
              </div>
          </div>
      )
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: TransferCartItem) => (
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => onRemove(record.key)} 
          />
      )
    },
  ];

  return (
    <Table 
      columns={columns}
      dataSource={items}
      pagination={false}
      rowKey="key"
      locale={{ emptyText: <Empty description="Chưa chọn sản phẩm nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  );
};
import { Space, Empty } from 'antd'; // Auto-fix import

export default TransferProductTable;
