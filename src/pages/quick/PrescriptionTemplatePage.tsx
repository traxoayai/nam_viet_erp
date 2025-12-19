// src/pages/quick/PrescriptionTemplatePage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  MedicineBoxOutlined,
  //   CopyOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  ConfigProvider,
  Space,
  Tag,
  Form,
  message,
  //   Tooltip,
  Popconfirm,
  Divider,
  Affix,
  InputNumber,
  Empty,
  Badge,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useEffect, useState } from "react";

import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";
import { usePrescriptionTemplateStore } from "@/features/settings/stores/usePrescriptionTemplateStore";
import { PrescriptionTemplate } from "@/features/settings/types/prescriptionTemplate";

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: {
    border: "1px solid #d0d7de",
    borderRadius: "6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  affixCard: {
    border: "1px solid #d0d7de",
    borderTop: 0,
    borderRadius: "0 0 6px 6px",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
  },
  formListCard: {
    border: "1px dashed #d0d7de",
    backgroundColor: "#fafbfc",
    marginBottom: 12,
  },
};

const PrescriptionTemplatePage: React.FC = () => {
  const {
    templates,
    loading,
    editingTemplate,
    viewMode,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    showForm,
    showList,
  } = usePrescriptionTemplateStore();

  const [form] = Form.useForm();

  // --- STATE CHO TÌM KIẾM & LỌC ---
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );

  // State để clear ô tìm thuốc trong Form
  const [selectValue, setSelectValue] = useState<any>(null);

  // 1. Load dữ liệu
  useEffect(() => {
    fetchTemplates(searchText, statusFilter);
  }, [searchText, statusFilter]);

  // 2. Tự động điền form khi sửa
  useEffect(() => {
    if (viewMode === "form") {
      if (editingTemplate) {
        form.setFieldsValue({
          ...editingTemplate.data,
          medicines: editingTemplate.items.map((i: any) => ({
            key: i.id,
            product_id: i.product_id,
            name: i.product_name,
            unit: i.product_unit,
            qty: i.quantity,
            usage_instruction: i.usage_instruction,
          })),
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: "active", medicines: [] });
      }
    }
  }, [viewMode, editingTemplate]);

  // --- CÁC HÀM XỬ LÝ (HANDLERS) ---

  const handleShowForm = (record: PrescriptionTemplate | null = null) => {
    showForm(record || undefined);
    // Reset select value khi mở form
    setSelectValue(null);
  };

  const handleBackToList = () => {
    showList();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const templateData = {
        name: values.name,
        diagnosis: values.diagnosis,
        note: values.note,
        status: values.status,
      };

      const items = (values.medicines || []).map((m: any) => ({
        product_id: m.product_id,
        quantity: m.qty,
        usage_instruction: m.usage_instruction,
      }));

      let success = false;
      if (editingTemplate) {
        success = await updateTemplate(
          editingTemplate.data.id,
          templateData,
          items
        );
      } else {
        success = await createTemplate(templateData, items);
      }

      if (success) handleBackToList();
    } catch (error) {
      console.error(error);
      message.error("Vui lòng kiểm tra lại các trường bắt buộc!");
    }
  };

  const handleSelectProduct = (_: any, option: any) => {
    if (!option?.product) return;

    const product = option.product;
    const currentList = form.getFieldValue("medicines") || [];

    // Kiểm tra trùng thuốc (Tùy chọn, ở đây cho phép trùng nhưng thường đơn thuốc ko nên trùng)
    // Nếu muốn cộng dồn số lượng thì thêm logic check existingIndex ở đây

    const newItem = {
      key: Math.random().toString(36).substr(2, 9),
      product_id: product.id,
      name: product.name,
      unit: product.retail_unit || product.unit,
      qty: 1,
      usage_instruction: "",
    };

    const newList = [...currentList, newItem];
    form.setFieldValue("medicines", newList);

    // Auto focus
    setTimeout(() => {
      const newIndex = newList.length - 1;
      const inputId = `usage_input_${newIndex}`;
      const element = document.getElementById(inputId);
      if (element) element.focus();
    }, 100);

    // Xóa trắng ô tìm kiếm
    setSelectValue(null);
  };

  // --- GIAO DIỆN DANH SÁCH (LIST VIEW) ---
  const renderListView = () => {
    const columns = [
      {
        title: "Tên Đơn mẫu",
        dataIndex: "name",
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: "Chẩn đoán",
        dataIndex: "diagnosis",
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: "Số thuốc",
        dataIndex: "item_count",
        align: "center" as const,
        width: 100,
        render: (count: number) => (
          <Badge count={count} showZero color="#108ee9" />
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 120,
        align: "center" as const,
        render: (status: string) => (
          <Badge
            status={status === "active" ? "success" : "default"}
            text={status === "active" ? "Hiện" : "Ẩn"}
          />
        ),
      },
      {
        title: "",
        key: "action",
        width: 120,
        render: (_: any, record: PrescriptionTemplate) => (
          <Space>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleShowForm(record)}
            />
            <Popconfirm
              title="Xóa?"
              onConfirm={() => deleteTemplate(record.id)}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Content
        style={{
          padding: "24px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Card style={styles.card} bordered={false} bodyStyle={{ padding: 0 }}>
          {/* Header */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              💊 Đơn thuốc Mẫu
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleShowForm()}
            >
              Tạo mới
            </Button>
          </div>

          {/* Filter Bar */}
          <div
            style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0" }}
          >
            <Row gutter={16}>
              <Col flex="auto">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo Tên đơn, Chẩn đoán..."
                  allowClear
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </Col>
              <Col flex="200px">
                <Select
                  placeholder="Trạng thái"
                  allowClear
                  style={{ width: "100%" }}
                  onChange={(val) => setStatusFilter(val)}
                >
                  <Select.Option value="active">Đang sử dụng</Select.Option>
                  <Select.Option value="inactive">Ngừng sử dụng</Select.Option>
                </Select>
              </Col>
            </Row>
          </div>

          <Table
            dataSource={templates}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Content>
    );
  };

  // --- GIAO DIỆN FORM (EDITOR VIEW) ---
  const renderFormView = () => (
    <Form form={form} layout="vertical" onFinish={handleSave}>
      <Affix offsetTop={0} style={{ zIndex: 99 }}>
        <div style={{ padding: "12px 24px", ...styles.affixCard }}>
          <Row
            justify="space-between"
            align="middle"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            <Col>
              <Space>
                {/* Nút Quay lại giờ đã nằm trong scope nên sẽ hoạt động */}
                <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
                  Quay lại
                </Button>
                <Divider type="vertical" />
                <Title level={5} style={{ margin: 0 }}>
                  {editingTemplate
                    ? `Cập nhật: ${editingTemplate.data.name}`
                    : "Tạo Đơn mẫu Mới"}
                </Title>
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={loading}
              >
                Lưu Đơn mẫu
              </Button>
            </Col>
          </Row>
        </div>
      </Affix>

      <Content style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        <Card
          style={{ ...styles.card, marginBottom: 24 }}
          title="Thông tin chung"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên đơn mẫu"
                rules={[{ required: true }]}
              >
                <Input placeholder="VD: Điều trị cảm cúm..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="diagnosis"
                label="Chẩn đoán (ICD-10)"
                rules={[{ required: true }]}
              >
                <Input placeholder="VD: J00 - Viêm mũi họng" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chú / Chỉ định">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select>
                  <Option value="active">🟢 Đang sử dụng</Option>
                  <Option value="inactive">⚪ Ngừng sử dụng</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          style={styles.card}
          title={
            <Space>
              <MedicineBoxOutlined /> Danh sách Thuốc
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <DebounceProductSelect
              placeholder="🔍 Tìm thuốc để thêm..."
              searchTypes={["product"]}
              value={selectValue}
              onChange={handleSelectProduct}
              style={{ width: "100%" }}
            />
          </div>

          <Form.List name="medicines">
            {(fields, { remove }) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    style={styles.formListCard}
                    bodyStyle={{ padding: "12px" }}
                  >
                    <Row gutter={12} align="middle">
                      <Col flex="auto">
                        <Form.Item
                          {...field}
                          name={[field.name, "name"]}
                          label="Tên thuốc"
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            readOnly
                            bordered={false}
                            style={{
                              fontWeight: 600,
                              color: "#1677ff",
                              paddingLeft: 0,
                            }}
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "product_id"]}
                          hidden
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "unit"]}
                          hidden
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col flex="100px">
                        <Form.Item
                          {...field}
                          name={[field.name, "qty"]}
                          label={`SL (${form.getFieldValue(["medicines", field.name, "unit"]) || "ĐV"})`}
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col flex="300px">
                        <Form.Item
                          {...field}
                          name={[field.name, "usage_instruction"]}
                          label="Cách dùng"
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            id={`usage_input_${index}`}
                            placeholder="Sáng 1, Tối 1 sau ăn..."
                          />
                        </Form.Item>
                      </Col>
                      <Col flex="32px" style={{ textAlign: "right" }}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          style={{ marginTop: 24 }}
                        />
                      </Col>
                    </Row>
                  </Card>
                ))}
                {fields.length === 0 && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có thuốc nào."
                  />
                )}
              </div>
            )}
          </Form.List>
        </Card>
      </Content>
    </Form>
  );

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={styles.layout}>
        {viewMode === "list" ? renderListView() : renderFormView()}
      </Layout>
    </ConfigProvider>
  );
};

export default PrescriptionTemplatePage;
