// src/pages/finance/invoices/InvoiceVerifyPage.tsx
import {
  SaveOutlined,
  ArrowLeftOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import {
  Layout, Row, Col, Card, Form, Input, DatePicker,
  InputNumber, Button, Table, Typography, Space,
  Select, Tag, Alert
} from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useInvoiceVerifyLogic } from "../../../features/finance/hooks/useInvoiceVerifyLogic";

dayjs.extend(customParseFormat);

const { Content } = Layout;
const { Title, Text } = Typography;

const InvoiceVerifyPage = () => {
  // 1. GỌI HOOK LOGIC (NEXUS)
  const {
      form,
      loading,
      isReadOnly,
      isXmlSource,
      xmlRawItems,
      suppliers,
      products,
      navigate,
      onFinish,
      handleRecalculate,
      routerState // Để lấy info header hiển thị raw
  } = useInvoiceVerifyLogic();

  // 2. CHUẨN HÓA DANH SÁCH OPTIONS (Tránh lỗi Crash filter)
  const productOptions = products.map(p => ({
      label: `${p.sku || 'N/A'} - ${p.name}`,
      value: p.id,
      // Thêm các trường phụ để search
      sku: p.sku,
      name: p.name,
      barcode: (p as any).barcode // Fix lint: barcode might not be in Product type
  }));

  const supplierOptions = suppliers.map((s: any) => ({
      label: `${s.name} - ${s.tax_code}`,
      value: s.id,
      tax_code: s.tax_code
  }));

  // 3. LOGIC FILTER AN TOÀN (Không đụng vào children)
  const filterOptionSafe = (input: string, option: any) => {
    if (!option?.label) return false;
    const tokens = input.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const label = String(option.label).toLowerCase();
    return tokens.every(token => label.includes(token));
  };

  // 4. LẤY INFO NCC TỪ XML (Để hiển thị gợi ý)
  const xmlHeader = isXmlSource ? routerState?.xmlData?.header : null;

  const columns = [
    {
      title: "Tên hàng (XML)",
      dataIndex: "name",
      width: 250,
      render: (_: any, __: any, index: number) => (
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Form.Item name={[index, "name"]} style={{ marginBottom: 0 }}>
               <Input 
                 readOnly 
                 variant="borderless" 
                 style={{ padding: 0, fontWeight: 500, color: '#1f1f1f' }} 
               />
            </Form.Item>
            {isXmlSource && xmlRawItems[index]?.match_type && (
                <div style={{ fontSize: 11, marginTop: 2 }}>
                    {xmlRawItems[index].match_type === 'exact' && <Tag color="success" icon={<CheckCircleOutlined />}>Đã học</Tag>}
                    {xmlRawItems[index].match_type === 'prediction' && <Tag color="warning" icon={<RobotOutlined />}>AI Gợi ý</Tag>}
                </div>
            )}
         </div>
      ),
    },
    ...(isXmlSource ? [{
        title: "ĐVT (XML)",
        dataIndex: "xml_unit",
        width: 90,
        render: (_: any, __: any, index: number) => (
          <Form.Item name={[index, "xml_unit"]} style={{ marginBottom: 0 }}>
            <Input disabled style={{ textAlign: 'center', background: '#fafafa', color: '#666', fontSize: 12 }} />
          </Form.Item>
        ),
      }] : []),
    {
      title: "Mã Nội Bộ",
      dataIndex: "product_id",
      width: 280,
      render: (_: any, _record: any, index: number) => (
        <Form.Item
          name={[index, "product_id"]}
          style={{ marginBottom: 0 }}
          rules={[{ required: true, message: "Chọn SP" }]}
        >
          <Select
            showSearch
            placeholder="Gõ tên, SKU..."
            options={productOptions} // Dùng options prop thay vì children
            filterOption={filterOptionSafe} // Filter an toàn
            disabled={isReadOnly}
            onChange={() => {
                const fields = form.getFieldsValue();
                const newItems = [...fields.items];
                if (newItems[index]) {
                    newItems[index].internal_unit = null; 
                    form.setFieldsValue({ items: newItems });
                }
            }}
            optionLabelProp="label"
          />
        </Form.Item>
      ),
    },
    {
      title: "ĐVT Nhập",
      dataIndex: "internal_unit",
      width: 100,// Tăng width lên chút cho thoải mái
      align: 'center' as const, // Căn giữa
      render: (_: any, _record: any, index: number) => (
         <Form.Item shouldUpdate={(prev, curr) => prev.items?.[index]?.product_id !== curr.items?.[index]?.product_id}>
            {({ getFieldValue }) => {
                const productId = getFieldValue(["items", index, "product_id"]);
                const selectedProduct = products.find(p => p.id === productId);
                
                const unitOptions = selectedProduct 
                    ? [
                        { value: selectedProduct.wholesale_unit, label: `${selectedProduct.wholesale_unit} (Sỉ)` },
                        { value: selectedProduct.retail_unit, label: `${selectedProduct.retail_unit} (Lẻ)` }
                      ].filter(u => u.value)
                    : [];

                return (
                    <Form.Item 
                        name={[index, "internal_unit"]} 
                        style={{ marginBottom: 0, width: '100%' }} // FIX LỆCH DÒNG
                        rules={[{ required: true, message: "Chọn ĐVT" }]}
                    >
                        <Select 
                            placeholder="Đơn vị" 
                            disabled={!productId || isReadOnly}
                            options={unitOptions}
                            style={{ width: '100%' }} // FIX LỆCH DÒNG
                        />
                    </Form.Item>
                );
            }}
         </Form.Item>
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "quantity"]} style={{ marginBottom: 0 }}>
          <InputNumber disabled style={{ width: "100%" }} controls={false} />
        </Form.Item>
      ),
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 130,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "unit_price"]} style={{ marginBottom: 0 }}>
          <InputNumber
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            disabled={isReadOnly}
            controls={false}
          />
        </Form.Item>
      ),
    },
    {
      title: "VAT %",
      dataIndex: "vat_rate",
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "vat_rate"]} style={{ marginBottom: 0 }}>
          <InputNumber min={0} max={100} style={{ width: "100%" }} disabled={isReadOnly} controls={false} />
        </Form.Item>
      ),
    },
    {
        title: "Hạn Dùng",
        dataIndex: "expiry_date",
        width: 130,
        render: (_: any, __: any, index: number) => (
          <Form.Item name={[index, "expiry_date"]} style={{ marginBottom: 0 }}>
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} disabled={isReadOnly} placeholder="DD/MM/YYYY" />
          </Form.Item>
        ),
      },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div style={{ padding: "12px 24px", background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/finance/invoices")}>Quay lại</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isXmlSource ? <Space><FileTextOutlined /> Đối Chiếu Hóa Đơn (XML)</Space> : "Chi Tiết Hóa Đơn"}
          </Title>
        </Space>
        {!isReadOnly && (
          <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={() => form.submit()}>
            Lưu & Nhập Kho
          </Button>
        )}
      </div>

      <Content style={{ padding: 24, overflowY: "auto", background: "#f0f2f5" }}>
         <Form form={form} layout="vertical" onFinish={onFinish} disabled={isReadOnly}>
            <Card title="1. Thông tin chung" size="small" style={{ marginBottom: 16 }}>
               {isXmlSource && xmlHeader && (
                   <Alert 
                     message={
                        <Space>
                            <InfoCircleOutlined /> 
                            <Text strong>Thông tin NCC từ XML:</Text> 
                            <Text>{xmlHeader.supplier_name}</Text>
                            <Tag color="blue">MST: {xmlHeader.supplier_tax_code}</Tag>
                            <Text type="secondary">({xmlHeader.supplier_address})</Text>
                        </Space>
                     }
                     type="info" 
                     showIcon={false}
                     style={{ marginBottom: 16, border: '1px dashed #1890ff', background: '#e6f7ff' }} 
                   />
               )}
               
               <Row gutter={16}>
                  <Col span={6}>
                     <Form.Item label="Số Hóa Đơn" name="invoice_number" rules={[{ required: true }]}>
                        <Input style={{ fontWeight: "bold" }} />
                     </Form.Item>
                  </Col>
                  <Col span={6}>
                     <Form.Item label="Ký hiệu" name="invoice_symbol">
                        <Input />
                     </Form.Item>
                  </Col>
                  <Col span={6}>
                     <Form.Item label="Ngày Hóa Đơn" name="invoice_date" rules={[{ required: true }]}>
                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                     </Form.Item>
                  </Col>
                  <Col span={6}>
                     <Form.Item 
                        label="Nhà Cung Cấp (Hệ thống)" 
                        name="supplier_id" 
                        rules={[{ required: true, message: "Chọn NCC" }]}
                        help="Nếu trống, hãy chọn NCC khớp với thông tin XML ở trên"
                     >
                        <Select
                            placeholder="Gõ tên hoặc MST để tìm..."
                            showSearch
                            options={supplierOptions} // Sử dụng options prop an toàn
                            filterOption={filterOptionSafe} // Hàm filter an toàn
                            allowClear
                        />
                     </Form.Item>
                  </Col>
               </Row>
            </Card>

            <Card 
                title={<Space><span>2. Chi tiết Hàng hóa</span><Button size="small" icon={<CalculatorOutlined />} onClick={handleRecalculate}>Tính lại tổng</Button></Space>} 
                size="small"
                styles={{ body: { padding: 0 } }}
            >
               <Form.List name="items">
                  {(fields) => (
                    <Table
                      dataSource={fields}
                      columns={columns}
                      pagination={false}
                      rowKey="key"
                      size="small"
                      scroll={{ x: 1300 }} 
                    />
                  )}
               </Form.List>

               <div style={{ padding: 16, background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
                  <Row justify="end">
                    <Col span={6}>
                      <Form.Item label="Tổng thanh toán (Sau thuế)" name="total_amount_post_tax" style={{ marginBottom: 0 }}>
                        <InputNumber
                          style={{ width: "100%", fontSize: 18, fontWeight: "bold", color: "#cf1322" }}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          addonAfter="₫"
                          readOnly
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
            </Card>
         </Form>
      </Content>
    </Layout>
  );
};

export default InvoiceVerifyPage;