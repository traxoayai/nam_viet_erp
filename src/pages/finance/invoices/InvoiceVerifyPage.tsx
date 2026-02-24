// src/pages/finance/invoices/InvoiceVerifyPage.tsx
import {
  SaveOutlined,
  ArrowLeftOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  CloseCircleOutlined,
  BarcodeOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Row,
  Col,
  Card,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Table,
  Typography,
  Space,
  Select,
  Tag,
  Alert,
} from "antd";
import { VerifyProductModal } from "@/features/finance/components/invoices/VerifyProductModal"; 
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import  { useState } from "react"; 
import { useInvoiceVerifyLogic } from "../../../features/finance/hooks/useInvoiceVerifyLogic";

dayjs.extend(customParseFormat);

import { getProductDetails } from "@/features/product/api/productService"; // [NEW] Fetch details if needed

const { Content } = Layout;
const { Title, Text } = Typography;

const InvoiceVerifyPage = () => {
  // [NEW] Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [selectingRowIndex, setSelectingRowIndex] = useState<number | null>(
    null
  );

  const handleOpenVerifyModal = (index: number) => {
    setSelectingRowIndex(index);
    setIsVerifyModalOpen(true);
  };

  // [NEW] Cache selected products locally to ensure we have full details (units)
  const [selectedProductsMap, setSelectedProductsMap] = useState<
    Record<number, any>
  >({});

  const handleSelectProduct = async (product: any) => {
    if (selectingRowIndex === null) return;

    // Ensure we have units.
    let fullProduct = product;
    if (!product.product_units || product.product_units.length === 0) {
      try {
        fullProduct = await getProductDetails(product.id);
      } catch (e) {
        console.error("Failed to fetch details", e);
      }
    }

    // Update Cache
    setSelectedProductsMap((prev) => ({
      ...prev,
      [fullProduct.id]: fullProduct,
    }));

    const fields = form.getFieldsValue();
    const newItems = [...fields.items];

    // Update row with selected product
    newItems[selectingRowIndex].product_id = fullProduct.id;
    // Reset internal unit
    newItems[selectingRowIndex].internal_unit = null;

    form.setFieldsValue({ items: newItems });
    setIsVerifyModalOpen(false);
    setSelectingRowIndex(null);
  };

  // [NEW] Handle Clear Selection
  const handleClearProduct = (index: number) => {
    const fields = form.getFieldsValue();
    const newItems = [...fields.items];

    if (newItems[index]) {
      newItems[index].product_id = null;
      newItems[index].internal_unit = null;
      // Reset quantity to original XML quantity if possible, or keep as is?
      // Usually if product is removed, we might revert/keep quantity.
      // Let's reset quantity to xml_quantity (base) because unit is gone.
      if (newItems[index].xml_quantity) {
        newItems[index].quantity = newItems[index].xml_quantity;
      }
      form.setFieldsValue({ items: newItems });
    }
  };

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
    onSaveDraft,
    routerState, // Để lấy info header hiển thị raw
  } = useInvoiceVerifyLogic();

  const supplierOptions = suppliers.map((s: any) => ({
    label: `${s.name} - ${s.tax_code}`,
    value: s.id,
    tax_code: s.tax_code,
  }));

  // 3. LOGIC FILTER AN TOÀN (Không đụng vào children)
  const filterOptionSafe = (input: string, option: any) => {
    if (!option?.label) return false;
    const tokens = input
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const label = String(option.label).toLowerCase();
    return tokens.every((token) => label.includes(token));
  };

  // 4. LẤY INFO NCC TỪ XML (Để hiển thị gợi ý)
  const xmlHeader = isXmlSource ? routerState?.xmlData?.header : null;

  const columns = [
    {
      title: "Tên hàng (XML)",
      dataIndex: "name",
      width: 250,
      render: (_: any, __: any, index: number) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Form.Item name={[index, "name"]} style={{ marginBottom: 0 }}>
            <Input
              readOnly
              variant="borderless"
              style={{ padding: 0, fontWeight: 500, color: "#1f1f1f" }}
            />
          </Form.Item>
          {isXmlSource && xmlRawItems[index]?.match_type ? <div style={{ fontSize: 11, marginTop: 2 }}>
                    {xmlRawItems[index].match_type === 'exact' && <Tag color="success" icon={<CheckCircleOutlined />}>Đã học</Tag>}
                    {xmlRawItems[index].match_type === 'prediction' && <Tag color="warning" icon={<RobotOutlined />}>AI Gợi ý</Tag>}
                </div> : null}
        </div>
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
    ...(isXmlSource
      ? [
          {
            title: "ĐVT (XML)",
            dataIndex: "xml_unit",
            width: 90,
            render: (_: any, __: any, index: number) => (
              <Form.Item name={[index, "xml_unit"]} style={{ marginBottom: 0 }}>
                <Input
                  disabled
                  style={{
                    textAlign: "center",
                    background: "#fafafa",
                    color: "#666",
                    fontSize: 12,
                  }}
                />
              </Form.Item>
            ),
          },
        ]
      : []),
    {
      title: "Mã Nội Bộ (Chọn)",
      dataIndex: "product_id",
      width: 250,
      render: (_: any, _record: any, index: number) => (
        <Form.Item
          shouldUpdate={(prev, curr) =>
            prev.items?.[index]?.product_id !== curr.items?.[index]?.product_id
          }
          style={{ marginBottom: 0 }}
        >
          {({ getFieldValue }) => {
            const productId = getFieldValue(["items", index, "product_id"]);

            // [FIX] Look up in Local Cache FIRST, then Store
            const selectedProduct =
              selectedProductsMap[productId] ||
              products.find((p) => p.id === productId);

            return (
              <div style={{ width: "100%" }}>
                {/* Hidden Input to store ID */}
                <Form.Item
                  name={[index, "product_id"]}
                  style={{ display: "none" }}
                  rules={[{ required: true, message: "Chọn SP" }]}
                >
                  <Input />
                </Form.Item>

                {!selectedProduct ? (
                  <Button
                    type="dashed"
                    icon={<SearchOutlined />}
                    onClick={() => handleOpenVerifyModal(index)}
                    danger={!productId && isXmlSource} // Highlight if missing mapping
                    style={{ width: "100%", textAlign: "left", color: "#999" }}
                  >
                    Chọn sản phẩm...
                  </Button>
                ) : (
                  <div
                    style={{
                      border: "1px solid #91caff",
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "#e6f7ff",
                      position: "relative",
                      cursor: "pointer",
                    }}
                    onClick={() => handleOpenVerifyModal(index)}
                  >
                    {/* Close Button */}
                    <div
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        zIndex: 10,
                        background: "#fff",
                        borderRadius: "50%",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearProduct(index);
                      }}
                    >
                      <CloseCircleOutlined
                        style={{ color: "#ff4d4f", fontSize: 16 }}
                      />
                    </div>

                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#096dd9",
                        fontSize: 13,
                      }}
                    >
                      {selectedProduct.sku}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#262626",
                        lineHeight: 1.2,
                      }}
                    >
                      {selectedProduct.name}
                    </div>
                    {selectedProduct.barcode ? <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                                   <BarcodeOutlined /> {selectedProduct.barcode}
                                </div> : null}
                  </div>
                )}
              </div>
            );
          }}
        </Form.Item>
      ),
    },
    {
      title: "ĐVT Nhập (Quy đổi)",
      dataIndex: "internal_unit",
      width: 220,
      align: "left" as const,
      render: (_: any, _record: any, index: number) => (
        <Form.Item
          shouldUpdate={(prev, curr) =>
            prev.items?.[index]?.product_id !==
              curr.items?.[index]?.product_id ||
            prev.items?.[index]?.quantity !== curr.items?.[index]?.quantity ||
            prev.items?.[index]?.internal_unit !==
              curr.items?.[index]?.internal_unit
          }
        >
          {({ getFieldValue }) => {
            const productId = getFieldValue(["items", index, "product_id"]);
            // Cache lookup
            const selectedProduct =
              selectedProductsMap[productId] ||
              products.find((p) => p.id === productId);

            if (!selectedProduct)
              return (
                <span style={{ color: "#ccc", fontStyle: "italic" }}>
                  Chưa khớp SP
                </span>
              );

            const currentQty = getFieldValue(["items", index, "quantity"]) || 0;
            const currentUnitId = getFieldValue([
              "items",
              index,
              "internal_unit",
            ]);
            const baseXmlQty =
              getFieldValue(["items", index, "xml_quantity"]) || 0;

            const units =
              selectedProduct.product_units || selectedProduct.units || [];
            const selectedUnitObj = units.find(
              (u: any) => u.id === currentUnitId
            );
            const unitName = selectedUnitObj?.unit_name || "";
            const rate = selectedUnitObj?.conversion_rate || 1;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Form.Item
                  name={[index, "internal_unit"]}
                  style={{ marginBottom: 0, width: "100%" }}
                  rules={[{ required: true, message: "Chọn ĐVT" }]}
                >
                  <Select
                    placeholder="Chọn ĐVT"
                    disabled={isReadOnly}
                    style={{ width: "100%" }}
                    onChange={(_value, option: any) => {
                      // [LOGIC]: Update Quantity & Price based on Scale
                      // 1. Get Rate
                      const newRate = option?.data_rate || 1;

                      const fields = form.getFieldsValue();
                      const newItems = [...fields.items];

                      if (newItems[index]) {
                        // 2. Update Quantity (Scale Down: Base / Rate)
                        if (baseXmlQty > 0) {
                          const newQty = baseXmlQty / newRate;
                          newItems[index].quantity = newQty;
                        }

                        // 3. Update Unit Price (Scale Up: Base * Rate) [NEW LOGIC]
                        // Use xml_unit_price (base price from invoice) as source of truth
                        const basePrice = newItems[index].xml_unit_price || 0;
                        if (basePrice > 0) {
                          const newPrice = basePrice * newRate;
                          newItems[index].unit_price = newPrice;
                        }

                        // 4. Apply to Form & Recalculate Total
                        form.setFieldsValue({ items: newItems });
                        setTimeout(() => handleRecalculate(), 0);
                      }
                    }}
                  >
                    {units.map((u: any) => (
                      <Select.Option
                        key={u.id}
                        value={u.id}
                        data_rate={u.conversion_rate}
                      >
                        {u.unit_name} (Rate: {u.conversion_rate})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* Display Conversion Info */}
                {currentUnitId ? <div style={{ fontSize: 11, color: '#666', lineHeight: 1.2 }}>
                                {rate > 1 ? (
                                    <Tag color="orange" style={{ margin: 0 }}>
                                       Quy đổi: <b>{Number(currentQty).toFixed(2)}</b> {unitName}
                                    </Tag>
                                ) : (
                                    <span style={{ color: '#888' }}>(Đơn vị cơ bản)</span>
                                )}
                            </div> : null}
              </div>
            );
          }}
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
          <InputNumber
            min={0}
            max={100}
            style={{ width: "100%" }}
            disabled={isReadOnly}
            controls={false}
          />
        </Form.Item>
      ),
    },
    {
      title: "Hạn Dùng",
      dataIndex: "expiry_date",
      width: 130,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "expiry_date"]} style={{ marginBottom: 0 }}>
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
            disabled={isReadOnly}
            placeholder="DD/MM/YYYY"
          />
        </Form.Item>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/finance/invoices")}
          >
            Quay lại
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {isXmlSource ? (
              <Space>
                <FileTextOutlined /> Đối Chiếu Hóa Đơn (XML)
              </Space>
            ) : (
              "Chi Tiết Hóa Đơn"
            )}
          </Title>
        </Space>
        {!isReadOnly && (
          <Space>
            <Button
              icon={<SaveOutlined />}
              loading={loading}
              onClick={() => onSaveDraft(form.getFieldsValue())}
            >
              Lưu Nháp
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={loading}
              onClick={() => form.submit()}
            >
              Lưu & Nhập Kho
            </Button>
          </Space>
        )}
      </div>

      <Content
        style={{ padding: 24, overflowY: "auto", background: "#f0f2f5" }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={isReadOnly}
        >
          <Card
            title="1. Thông tin chung"
            size="small"
            style={{ marginBottom: 16 }}
          >
            {isXmlSource && xmlHeader ? <Alert 
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
                   /> : null}

            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  label="Số Hóa Đơn"
                  name="invoice_number"
                  rules={[{ required: true }]}
                >
                  <Input style={{ fontWeight: "bold" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Ký hiệu" name="invoice_symbol">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="Ngày Hóa Đơn"
                  name="invoice_date"
                  rules={[{ required: true }]}
                >
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
            title={
              <Space>
                <span>2. Chi tiết Hàng hóa</span>
                <Button
                  size="small"
                  icon={<CalculatorOutlined />}
                  onClick={handleRecalculate}
                >
                  Tính lại tổng
                </Button>
              </Space>
            }
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

            <div
              style={{
                padding: 16,
                background: "#fafafa",
                borderTop: "1px solid #f0f0f0",
              }}
            >
              <Row justify="end">
                <Col span={6}>
                  <Form.Item
                    label="Tổng thanh toán (Sau thuế)"
                    name="total_amount_post_tax"
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      style={{
                        width: "100%",
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#cf1322",
                      }}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
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

      {/* [NEW] Verify Modal */}
      <VerifyProductModal
        open={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onSelect={handleSelectProduct}
      />
    </Layout>
  );
};

export default InvoiceVerifyPage;
