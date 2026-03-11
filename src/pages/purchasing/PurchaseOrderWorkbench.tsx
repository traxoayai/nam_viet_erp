// src/pages/purchasing/PurchaseOrderWorkbench.tsx
import React, { useState } from 'react';
import { 
  Form, Input, InputNumber, Button, Card, Row, Col, 
  Table, Tag, Typography, Space, Upload, Select, DatePicker, Affix, Modal 
} from 'antd';
import { 
  UploadOutlined, SaveOutlined, PrinterOutlined, 
  CheckCircleOutlined, DollarOutlined, RetweetOutlined, DeleteOutlined 
} from '@ant-design/icons';
import { usePurchaseWorkbenchLogic } from './hooks/usePurchaseWorkbenchLogic';
import { useParams } from 'react-router-dom';
import DebounceProductSelect from '@/shared/ui/common/DebounceProductSelect';

// Giả định import các Modal. Trong thực tế bạn cần trỏ đúng đường dẫn.
// import UpdatePriceModal from './components/UpdatePriceModal';
// import FinanceFormModal from '@/features/finance/components/FinanceFormModal';

const { Title, Text } = Typography;

const PurchaseOrderWorkbench: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    form, 
    poStatus, 
    totals, 
    flags, 
    loading,
    saveLoading,
    suppliers,
    handleValuesChange, 
    handleUploadXML,
    handleSelectProduct,
    handleRemoveItem,
    handleSaveDraft,
    handleOrder
  } = usePurchaseWorkbenchLogic(id);

  //const { suppliers } = useProductStore();

  const [isUpdatePriceModalVisible, setUpdatePriceModalVisible] = useState(false);
  const [isFinanceModalVisible, setFinanceModalVisible] = useState(false);
  
  // Dummy data for dropdowns
  const programs = [{ label: 'CK Tháng 3', value: 'prog_1' }];
  
  const columns = [
    {
      title: 'STT',
      dataIndex: 'index',
      render: (_: any, __: any, index: number) => index + 1,
      width: 60,
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'product_name',
      render: (text: string, record: any) => (
        <Space>
          {record.product_image && <img src={record.product_image} alt="pic" width={40} />}
          <div>
            <Text strong>{text}</Text>
            <div><Text type="secondary" style={{fontSize: 12}}>SKU: {record.sku}</Text></div>
          </div>
        </Space>
      )
    },
    { title: 'ĐVT', dataIndex: 'unit_name', width: 80 },
    { 
      title: 'Số lượng', 
      dataIndex: 'quantity', 
      width: 100,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'quantity']} noStyle>
          <InputNumber min={0} />
        </Form.Item>
      )
    },
    { 
      title: 'Đơn giá (trước VAT)', 
      dataIndex: 'unit_price', 
      width: 140,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'unit_price']} noStyle>
          <InputNumber min={0} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} style={{width: 120}} />
        </Form.Item>
      )
    },
    { 
      title: 'Chiết khấu (%)', 
      dataIndex: 'discount_rate', 
      width: 100,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'discount_rate']} noStyle>
          <InputNumber min={0} max={100} />
        </Form.Item>
      )
    },
    { 
      title: 'VAT (%)', 
      dataIndex: 'vat_rate', 
      width: 100,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'vat_rate']} noStyle>
          <InputNumber min={0} max={100} />
        </Form.Item>
      )
    },
    { 
      title: 'Quà tặng', 
      dataIndex: 'is_bonus', 
      width: 90,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'is_bonus']} valuePropName="checked" noStyle>
          <input type="checkbox" />
        </Form.Item>
      )
    },
    { 
      title: 'GIÁ VỐN (FINAL)', 
      dataIndex: 'final_base_cost', 
      width: 140,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={['items', index, 'final_base_cost']} noStyle>
          <InputNumber 
            style={{width: '100%', fontWeight: 'bold'}} 
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
          />
        </Form.Item>
      )
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveItem(index)} />
      )
    }
  ];

  return (
    <div style={{ padding: 24, paddingBottom: 100, background: '#f0f2f5', minHeight: '100vh' }}>
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange} disabled={loading}>
        
        {/* HEADER */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Title level={4} style={{ margin: 0 }}>Đơn mua hàng mới</Title>
              <Tag color={poStatus === 'DRAFT' ? 'default' : 'blue'}>{poStatus}</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              {flags.showSaveDraft && <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saveLoading}>Lưu nháp</Button>}
              {flags.showOrder && <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleOrder} loading={saveLoading}>Đặt hàng</Button>}
              {flags.showPrint && <Button icon={<PrinterOutlined />}>In đơn</Button>}
              {flags.showPayment && (
                <Button 
                  icon={<DollarOutlined />} 
                  onClick={() => setFinanceModalVisible(true)}
                >
                  Thanh toán
                </Button>
              )}
              {flags.showUpdateCost && (
                <Button 
                  type="primary" 
                  icon={<RetweetOutlined />} 
                  onClick={() => setUpdatePriceModalVisible(true)}
                >
                  Cập nhật Giá Vốn
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* BLOCK A: Thông tin NCC */}
          <Col xs={24} lg={8}>
            <Card title="Thông tin Nhập Hàng" size="small" style={{height: '100%'}}>
              <Form.Item label="Nhà cung cấp" name="supplier_id">
                <Select placeholder="Chọn NCC" options={suppliers.map(s => ({ label: s.name, value: s.id }))} />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary">Nợ hiện tại:</Text>
                  <div><Text strong type="danger">0 ₫</Text></div>
                </Col>
                <Col span={12}>
                  <Form.Item label="Ngày giao dự kiến" name="expected_delivery_date" style={{marginBottom: 0}}>
                    <DatePicker style={{width: '100%'}} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Người liên hệ" name="contact_name" style={{marginTop: 8}}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="SĐT" name="contact_phone" style={{marginTop: 8}}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* BLOCK B: Vận chuyển */}
          <Col xs={24} lg={8}>
            <Card title="Vận chuyển" size="small" style={{height: '100%'}}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="Hình thức giao hàng" name="shipping_method">
                    <Select options={[{label: 'Giao tận nơi', value: 'DELIVERY'}, {label: 'Lấy tại kho', value: 'PICKUP'}]} placeholder="Chọn" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Đơn vị VC" name="shipping_company">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Tên Shipper" name="shipper_name">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Số ĐT Shipper" name="shipper_phone">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Số kiện" name="total_packages">
                    <InputNumber style={{width: '100%'}} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Phí VC" name="shipping_fee">
                    <InputNumber style={{width: '100%'}} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* BLOCK C & D */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{width: '100%'}} size="middle">
              {/* BLOCK C: Hợp đồng/Chiết khấu */}
              <Card title="Hợp đồng & Chiết khấu" size="small">
                <Form.Item label="Chương trình CK" name="supplier_program_id" style={{marginBottom: 8}}>
                  <Select options={programs} placeholder="Chọn chương trình" />
                </Form.Item>
                <Button type="link" style={{padding: 0}}>Xem chi tiết chương trình</Button>
              </Card>

              {/* BLOCK D: Nhập Hóa Đơn VAT */}
              <Card title="Hóa đơn VAT (XML/PDF)" size="small">
                <Upload beforeUpload={handleUploadXML} showUploadList={false}>
                  <Button icon={<UploadOutlined />} type="dashed" block>
                    Upload File XML Hóa Đơn
                  </Button>
                </Upload>
              </Card>
            </Space>
          </Col>
        </Row>

        {/* BLOCK E: Table Sản Phẩm */}
        <Card title="Danh sách sản phẩm" size="small" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <DebounceProductSelect 
              fetcher={(_search: string) => Promise.resolve([])} // Replace with actual search fetching logic from productService
              onChange={handleSelectProduct as any}
              placeholder="Tìm kiếm và thêm sản phẩm..."
            />
          </div>
          <Form.List name="items">
            {() => {
              const items = form.getFieldValue('items') || [];
              return (
                <Table 
                  dataSource={items.map((it: any, i: number) => ({...it, key: i}))}
                  columns={columns}
                  pagination={false}
                  rowKey="key"
                  size="small"
                />
              );
            }}
          </Form.List>
          <Button type="dashed" onClick={() => {
            const currentItems = form.getFieldValue('items') || [];
            form.setFieldsValue({
              items: [...currentItems, { 
                product_id: '', quantity: 1, unit_price: 0, 
                discount_rate: 0, vat_rate: 0, is_bonus: false 
              }]
            });
          }} style={{ marginTop: 16 }}>
            + Thêm dòng
          </Button>
        </Card>

        {/* BLOCK F: Tổng tiền - Sticky Footer */}
        <Affix offsetBottom={0}>
          <div style={{ 
            background: '#fff', 
            padding: '12px 24px', 
            borderTop: '2px solid #1890ff', 
            boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Space size="large">
              <Space direction="vertical" size={0}>
                <Text type="secondary">Tổng tiền hàng</Text>
                <Text strong>{totals.totalGoods.toLocaleString()} ₫</Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Tổng VAT</Text>
                <Text strong>{totals.totalVat.toLocaleString()} ₫</Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Tổng phí ship</Text>
                <Text strong>{totals.totalShipping.toLocaleString()} ₫</Text>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Chiết khấu tổng</Text>
                <Text strong type="danger">-{totals.totalDiscount.toLocaleString()} ₫</Text>
              </Space>
            </Space>
            
            <Space size="large" align="center">
              <Space direction="vertical" size={0} align="end">
                <Text type="secondary" style={{fontSize: 16}}>Khách Cần Trả (Final)</Text>
                <Text strong style={{fontSize: 24, color: '#1890ff'}}>
                  {totals.finalTotal.toLocaleString()} ₫
                </Text>
              </Space>
            </Space>
          </div>
        </Affix>
      </Form>

      {/* Placeholders for Modals */}
      {/* 
      <FinanceFormModal visible={isFinanceModalVisible} onCancel={() => setFinanceModalVisible(false)} />
      <UpdatePriceModal visible={isUpdatePriceModalVisible} onCancel={() => setUpdatePriceModalVisible(false)} oldCosts={[]} />
      */}
      <Modal open={isFinanceModalVisible} onCancel={() => setFinanceModalVisible(false)} title="Thanh Toán">
        Mock Modal Thanh Toán
      </Modal>
      <Modal open={isUpdatePriceModalVisible} onCancel={() => setUpdatePriceModalVisible(false)} title="Cập nhật Giá Vốn">
        Mock Modal Cập Nhật Giá Vốn
      </Modal>
    </div>
  );
};

export default PurchaseOrderWorkbench;
