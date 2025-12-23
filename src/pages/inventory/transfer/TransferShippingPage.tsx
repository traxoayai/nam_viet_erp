import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Typography, 
  Space, 
  Modal, 
  InputNumber, 
  Progress,
  List,
  Tag,
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DeploymentUnitOutlined, 
  CheckCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTransferStore } from '@/features/inventory/stores/useTransferStore';
import { TransferItem } from '@/features/inventory/types/transfer';

const { Title, Text } = Typography;

const TransferShippingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    currentTransfer, 
    getDetail, 
    loadAvailableBatches,
    shippingDraft,
    setShippingDraft,
    submitTransferShipment
  } = useTransferStore();

  const [activeItem, setActiveItem] = useState<TransferItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [pickedQuantities, setPickedQuantities] = useState<Record<number, number>>({}); // batchId -> qty

  useEffect(() => {
    if (id && (!currentTransfer || currentTransfer.id !== Number(id))) {
      getDetail(Number(id));
      // Reset draft if needed or handled in store
    }
  }, [id, currentTransfer, getDetail]);

  const handleOpenPickModal = async (item: TransferItem) => {
    setActiveItem(item);
    setModalOpen(true);
    setPickedQuantities({}); // Reset local picker
    
    // Load batches
    const batches = await loadAvailableBatches(item.product_id);
    setAvailableBatches(batches);

    // If already picked in draft, populate
    const currentDraft = shippingDraft[item.id] || [];
    const draftMap: Record<number, number> = {};
    currentDraft.forEach(b => {
        draftMap[b.id] = b.quantity_picked;
    });
    setPickedQuantities(draftMap);
  };

  const handleConfirmPick = () => {
    if (!activeItem) return;

    // Convert local picked state to draft format
    const pickedList = availableBatches
        .filter(b => pickedQuantities[b.id] > 0)
        .map(b => ({
            ...b,
            quantity_picked: pickedQuantities[b.id]
        }));
    
    setShippingDraft(activeItem.id, pickedList);
    setModalOpen(false);
    setActiveItem(null);
  };

  const handleSubmitShipment = async () => {
      Modal.confirm({
          title: 'Xác nhận xuất kho',
          content: 'Bạn có chắc chắn muốn hoàn tất xuất kho cho các lô đã chọn?',
          okText: 'Xuất kho ngay',
          onOk: async () => {
            const success = await submitTransferShipment();
            if (success) {
                navigate(`/inventory/transfers/${id}`);
            }
          }
      });
  };

  const getPickedQty = (itemId: number) => {
      const draft = shippingDraft[itemId];
      if (!draft) return 0;
      return draft.reduce((sum, b) => sum + (b.quantity_picked || 0), 0);
  };

  const columns = [
    {
      title: 'Sản phẩm',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (text: string, record: TransferItem) => (
          <div>
              <Text strong>{text}</Text>
              <br />
              <Text type="secondary">{record.sku}</Text>
          </div>
      )
    },
    {
      title: 'Yêu cầu',
      dataIndex: 'quantity_requested',
      key: 'qty',
      width: 120,
      render: (val: number, record: TransferItem) => <Text>{val} {record.uom}</Text>
    },
    {
      title: 'Đã nhặt',
      key: 'picked',
      width: 200,
      render: (_: any, record: TransferItem) => {
          const picked = getPickedQty(record.id);
          const percent = Math.min(100, Math.round((picked / record.quantity_requested) * 100));
          return (
              <div style={{ width: 180 }}>
                  <Progress percent={percent} size="small" status={picked >= record.quantity_requested ? 'success' : 'active'} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{picked} / {record.quantity_requested} {record.uom}</Text>
              </div>
          );
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: TransferItem) => (
          <Button 
            icon={<DeploymentUnitOutlined />} 
            onClick={() => handleOpenPickModal(record)}
            type={getPickedQty(record.id) > 0 ? 'default' : 'dashed'}
          >
              {getPickedQty(record.id) > 0 ? 'Chỉnh sửa lô' : 'Chọn lô'}
          </Button>
      )
    }
  ];

  if (!currentTransfer) return <Card loading />;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/inventory/transfers/${id}`)} />
            <Title level={3} style={{ margin: 0 }}>Xuất kho Phiếu {currentTransfer.code}</Title>
        </Space>

        <Card 
            title="Danh sách cần xuất kho" 
            extra={
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleSubmitShipment}>
                    Hoàn tất Xuất kho
                </Button>
            }
        >
            <Table
                dataSource={currentTransfer.items}
                columns={columns}
                rowKey="id"
                pagination={false}
            />
        </Card>

        {/* BATCH PICKER MODAL */}
        <Modal
            title={`Chọn lô cho: ${activeItem?.product_name}`}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onOk={handleConfirmPick}
            width={700}
        >
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                <List
                    dataSource={availableBatches}
                    renderItem={(batch) => {
                        const available = batch.quantity; // Assuming backend returns 'quantity' as available
                        const currentPick = pickedQuantities[batch.id] || 0;
                        
                        return (
                            <List.Item>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>{batch.batch_code}</Text>
                                        <Tag color={dayjs(batch.expiry_date).isBefore(dayjs()) ? 'red' : 'green'}>
                                            HSD: {dayjs(batch.expiry_date).format('DD/MM/YYYY')}
                                        </Tag>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text>Tồn kho: {available}</Text>
                                        <Space>
                                            <Text>Xuất:</Text>
                                            <InputNumber
                                                min={0}
                                                max={available}
                                                value={currentPick}
                                                onChange={(val) => setPickedQuantities(prev => ({ ...prev, [batch.id]: val || 0 }))}
                                                style={{ width: 100 }}
                                            />
                                        </Space>
                                    </div>
                                </Space>
                            </List.Item>
                        );
                    }}
                />
                {availableBatches.length === 0 && <Text type="secondary">Không có lô nào khả dụng.</Text>}
            </div>
        </Modal>
    </div>
  );
};

export default TransferShippingPage;
