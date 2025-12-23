import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  message, 
  Modal, 
  Input,
  InputNumber,
  Row,
  Col
} from 'antd';
import { 
  ArrowLeftOutlined, 
  StopOutlined, 
  ExportOutlined, 
  PrinterOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTransferStore } from '@/features/inventory/stores/useTransferStore';
import { TransferItem } from '@/features/inventory/types/transfer';

const { Title, Text } = Typography;
const { TextArea } = Input;

const TransferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    currentTransfer, 
    loading, 
    isAllocationDone, 
    shippingDraft,
    scannedCode,
    initTransferOperation, 
    handleBarcodeScan,
    updateDraftItem,
    submitTransferShipment,
    updateStatus,
    cancelRequest
  } = useTransferStore();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Ref for auto-focus
  const barcodeInputRef = useRef<any>(null);

  useEffect(() => {
    if (id) {
        initTransferOperation(Number(id));
    }
  }, [id, initTransferOperation]);

  // Focus barcode input on mount and keep focus logic could be added here
  useEffect(() => {
      // Small timeout to ensure render
      setTimeout(() => barcodeInputRef.current?.focus(), 500);
  }, [loading]);

  // Sync scannedCode from store to input clear
  useEffect(() => {
     if (scannedCode) {
         setBarcodeInput(''); // Clear input after successful scan
     }
  }, [scannedCode]);

  // --- ACTIONS ---

  const onScan = () => {
      if (!barcodeInput.trim()) return;
      handleBarcodeScan(barcodeInput.trim());
  };

  const handleCancelSubmit = async () => {
      if (!currentTransfer) return;
      if (!cancelReason.trim()) {
          message.error('Vui lòng nhập lý do hủy');
          return;
      }
      
      const success = await cancelRequest(currentTransfer.id, cancelReason);
      if (success) {
          setCancelModalOpen(false);
          setCancelReason('');
          navigate('/inventory/transfer');
      }
  };

  const handleSubmitOutbound = () => {
      Modal.confirm({
          title: 'Xác nhận xuất kho',
          content: 'Hệ thống đã tự động gán lô theo nguyên tắc FEFO. Bạn có chắc chắn muốn xuất kho?',
          okText: 'Xuất kho ngay',
          onOk: async () => {
              const success = await submitTransferShipment();
              if (success) {
                  // Stay on page, status updates to 'shipped' (or logic triggers refresh)
                  // For now, assume store handles refresh or we reload
                  if (id) initTransferOperation(Number(id));
              }
          }
      });
  };

  const handleReceive = () => {
      if (!currentTransfer) return;
      Modal.confirm({
          title: 'Xác nhận nhập kho',
          content: 'Xác nhận kho đích đã nhận đủ hàng?',
          okText: 'Xác nhận',
          okButtonProps: { style: { backgroundColor: '#52c41a' } },
          onOk: async () => {
              await updateStatus(currentTransfer.id, 'completed');
              message.success('Đã nhập kho thành công');
              navigate('/inventory/transfer');
          }
      });
  };

  // --- HELPER FOR TABLE ---
  
  // Get currently selected batch for an item (Simplified V1: assumes 1 batch or sums it up)
  // Logic: For V1, the 'Select' will show the primary batch. If multiple, maybe just showing "Mixed" is safer?
  // Let's create a renderer that shows a dropdown of picked batches + "Add Batch" option ideally.
  // SIMPLIFICATION: show the batch with highest allocated quantity as the "Main" batch in dropdown.
  
  const renderBatchSelector = (item: TransferItem) => {
      const pickedBatches = shippingDraft[item.id] || [];
      // Picked batches that actually have quantity > 0
      const activePicked = pickedBatches.filter(b => b.quantity_picked > 0);
      
      if (activePicked.length === 0) return <Text type="secondary" italic>Chưa có lô</Text>;
      
      // For V1 allow editing the quantity of the FIRST active batch
      const primaryBatch = activePicked[0];
      
      return (
          <Space direction="vertical" style={{ width: '100%' }}>
              <Tag color="blue">{primaryBatch.batch_code}</Tag>
              <Text type="secondary" style={{ fontSize: 10 }}>HSD: {dayjs(primaryBatch.expiry_date).format('DD/MM/YY')}</Text>
          </Space>
      );
  };
  
  const renderQuantityInput = (item: TransferItem) => {
      const pickedBatches = shippingDraft[item.id] || [];
      const totalPicked = pickedBatches.reduce((acc, b) => acc + (b.quantity_picked || 0), 0);
      const isFulfilled = totalPicked >= item.quantity_requested;
      
      // We allow editing the first batch's quantity if it exists, roughly.
      // But 'totalPicked' is what matters. 
      // V1 UX: Just show total picked. If they want to edit, they use the "Edit" button (future).
      // Here we allow changing total picked -> applies to first batch.
      
      const onQtyChange = (val: number | null) => {
          if (val === null) return;
          // Apply diff to primary batch
          if (pickedBatches.length > 0) {
              updateDraftItem(item.id, pickedBatches[0].id, val);
          }
      };

      return (
         <Space>
             <InputNumber 
                value={totalPicked} 
                onChange={onQtyChange}
                min={0}
                max={item.quantity_requested + 10} // Allow slight overpick? maybe not
                status={isFulfilled ? '' : 'warning'}
             />
             {isFulfilled && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
         </Space>
      );
  };

  // --- COLUMNS ---

  const columns = [
    {
      title: 'Mã / Tên sản phẩm',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (text: string, record: TransferItem) => (
          <div>
              <Text strong>{text}</Text>
              <div><Text type="secondary">{record.sku}</Text></div>
          </div>
      )
    },
    {
      title: 'Yêu cầu',
      dataIndex: 'quantity_requested',
      key: 'req',
      width: 100,
      render: (val: number, record: TransferItem) => <Text>{val} {record.uom}</Text>
    },
    {
      title: 'Thực xuất',
      key: 'picked',
      width: 150,
      render: (_: any, record: TransferItem) => isPending ? renderQuantityInput(record) : <Text strong>{record.quantity_shipped ?? 0}</Text>
    },
    {
      title: 'Lô hàng (FEFO)',
      key: 'batch',
      width: 200,
      render: (_: any, record: TransferItem) => isPending ? renderBatchSelector(record) : <Text type="secondary">{record.quantity_shipped ? 'Đã xuất' : '---'}</Text>
    }
  ];

  const getStatusTag = (status: string) => {
    switch (status) {
        case 'pending': return <Tag color="gold">Chờ xuất kho</Tag>;
        case 'approved': return <Tag color="blue">Đã duyệt (Cũ)</Tag>;
        case 'shipping': return <Tag color="cyan">Đang chuyển hàng</Tag>;
        case 'completed': return <Tag color="green">Hoàn thành</Tag>;
        case 'cancelled': return <Tag color="red">Đã hủy</Tag>;
        default: return <Tag>{status}</Tag>;
    }
  };

  if (loading && !currentTransfer) {
      return <Card loading={true} />;
  }

  if (!currentTransfer) {
      return (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Title level={4}>Không tải được dữ liệu phiếu</Title>
            <Button onClick={() => navigate('/inventory/transfer')}>Quay lại</Button>
          </div>
      );
  }

  const isPending = currentTransfer.status === 'pending';
  const isShipping = currentTransfer.status === 'shipping';

  return (
    <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
      {/* HEADER & ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventory/transfer')} />
            <div>
                <Title level={3} style={{ margin: 0 }}>
                    {currentTransfer.code}
                </Title>
                <Space>
                    {getStatusTag(currentTransfer.status)}
                    <Text type="secondary">{dayjs(currentTransfer.created_at).format('DD/MM/YYYY HH:mm')}</Text>
                </Space>
            </div>
        </Space>

        <Space>
            {isPending && (
                <>
                    <Button danger icon={<StopOutlined />} onClick={() => setCancelModalOpen(true)}>
                        Hủy phiếu
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<ExportOutlined />} 
                        onClick={handleSubmitOutbound}
                        disabled={!isAllocationDone}
                    >
                        Xác nhận Xuất kho
                    </Button>
                </>
            )}
            {isShipping && (
                <Button type="primary" style={{ backgroundColor: '#52c41a' }} icon={<DownloadOutlined />} onClick={handleReceive}>
                    Xác nhận Nhập kho
                </Button>
            )}
            <Button icon={<PrinterOutlined />}>In phiếu</Button>
        </Space>
      </div>

      <Row gutter={24}>
          <Col span={16}>
            {/* ITEMS TABLE */}
            <Card 
                title={
                    <Space>
                        <Text strong>📦 Danh sách hàng hóa</Text>
                        {isPending && <Tag color="blue">Tự động chọn lô (FEFO)</Tag>}
                    </Space>
                } 
                bodyStyle={{ padding: 0 }}
            >
                {/* SCANNER INPUT */}
                {isPending && (
                    <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
                        <Input 
                            ref={barcodeInputRef}
                            prefix={<BarcodeOutlined />} 
                            placeholder="Quét mã vạch sản phẩm để tăng số lượng..." 
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            onPressEnter={onScan}
                            size="large"
                            autoFocus
                        />
                    </div>
                )}
                
                <Table
                    dataSource={currentTransfer.items}
                    columns={columns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ y: 500 }}
                />
            </Card>
          </Col>
          <Col span={8}>
                {/* INFO SIDEBAR */}
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Card title="Thông tin chung" size="small">
                        <Descriptions column={1} size="small">
                            <Descriptions.Item label="Kho nguồn">
                                <b>{currentTransfer.source_warehouse_name}</b>
                            </Descriptions.Item>
                            <Descriptions.Item label="Kho đích">
                                <b>{currentTransfer.dest_warehouse_name}</b>
                            </Descriptions.Item>
                            <Descriptions.Item label="Người tạo">
                                {currentTransfer.creator_name || 'Admin'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ghi chú">
                                {currentTransfer.note || '---'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="Vận chuyển" size="small">
                         <Descriptions column={1} size="small">
                            <Descriptions.Item label="Phương thức">
                                Tự vận chuyển
                            </Descriptions.Item>
                            <Descriptions.Item label="Dự kiến">
                                {dayjs().add(1, 'day').format('DD/MM/YYYY')}
                            </Descriptions.Item>
                         </Descriptions>
                    </Card>
                </Space>
          </Col>
      </Row>

      {/* CANCEL MODAL */}
      <Modal
        title="Hủy phiếu chuyển kho"
        open={cancelModalOpen}
        onOk={handleCancelSubmit}
        onCancel={() => setCancelModalOpen(false)}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
      >
          <Text>Lý do hủy:</Text>
          <TextArea 
            rows={4} 
            value={cancelReason} 
            onChange={(e) => setCancelReason(e.target.value)}
            style={{ marginTop: 8 }}
          />
      </Modal>
    </div>
  );
};

export default TransferDetailPage;
