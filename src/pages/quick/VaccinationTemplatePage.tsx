// src/pages/quick/VaccinationTemplatePage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  MedicineBoxOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
  FieldTimeOutlined,
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
  Tooltip,
  Popconfirm,
  Divider,
  Affix,
  InputNumber,
  Empty,
  Badge,
  //App as AntApp,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useEffect, useState } from "react";

import { useVaccinationTemplateStore } from "@/features/marketing/stores/useVaccinationTemplateStore";
import { VaccinationTemplate } from "@/features/marketing/types/vaccination";
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: { borderRadius: "6px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  affixCard: {
    borderBottom: "1px solid #f0f0f0",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
  },
  formListCard: {
    border: "1px dashed #d0d7de",
    backgroundColor: "#fafbfc",
    marginBottom: 12,
  },
};

const formatAge = (months: number) => {
  if (months < 12) return `${months} tháng`;
  if (months % 12 === 0) return `${months / 12} tuổi`;
  return `${(months / 12).toFixed(1)} tuổi`;
};

const VaccinationTemplatePage: React.FC = () => {
  // const { message } = AntApp.useApp();
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
  } = useVaccinationTemplateStore();

  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [selectValue, setSelectValue] = useState<any>(null);

  useEffect(() => {
    fetchTemplates(searchText, statusFilter);
  }, [searchText, statusFilter]);

  useEffect(() => {
    if (viewMode === "form") {
      if (editingTemplate) {
        form.setFieldsValue({
          ...editingTemplate.data,
          schedules: editingTemplate.items.map((i: any) => ({
            key: i.id,
            product_id: i.product_id,
            product_name: i.product_name,
            product_sku: i.product_sku,
            shotName: i.shot_name,
            daysAfterStart: i.days_after_start,
            note: i.note,
          })),
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: "active",
          minAgeMonths: 0,
          maxAgeMonths: 999,
          schedules: [],
        });
      }
    }
  }, [viewMode, editingTemplate]);

  const handleShowForm = (record: VaccinationTemplate | null = null) => {
    showForm(record || undefined);
    if (!record) setSelectValue(null);
  };

  const handleBackToList = () => showList();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const templateData = {
        name: values.name,
        description: values.description,
        min_age_months: values.minAgeMonths,
        max_age_months: values.maxAgeMonths,
        status: values.status,
      };

      const items = (values.schedules || []).map((s: any) => ({
        product_id: s.product_id,
        shot_name: s.shotName,
        days_after_start: s.daysAfterStart,
        note: s.note,
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

      if (success) showList();
    } catch (error) {
      console.error("Validate failed:", error);
    }
  };

  // --- FIX LỖI 1: Sửa logic newList ---
  const handleSelectProduct = (_: any, option: any) => {
    if (!option?.product) return;
    const product = option.product;
    const currentList = form.getFieldValue("schedules") || [];

    const lastItem = currentList[currentList.length - 1];
    const nextDays = lastItem ? lastItem.daysAfterStart + 30 : 0;

    const newItem = {
      key: Math.random().toString(),
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      shotName: `Mũi ${currentList.length + 1}`,
      daysAfterStart: nextDays,
      note: "",
    };

    // Tạo biến newList rõ ràng
    const newList = [...currentList, newItem];
    form.setFieldValue("schedules", newList);

    setSelectValue(null);

    // Dùng biến newList ở đây sẽ không bị lỗi nữa
    setTimeout(() => {
      const newIndex = newList.length - 1;
      const inputId = `usage_input_${newIndex}`;
      const element = document.getElementById(inputId);
      if (element) element.focus();
    }, 100);
  };

  const renderListView = () => {
    const columns = [
      {
        title: "Tên Phác đồ",
        dataIndex: "name",
        width: 250,
        render: (text: string, r: any) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 15 }}>
              {text}
            </Text>
            {r.description ? (
              <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                {r.description}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Độ tuổi",
        align: "center" as const,
        width: 150,
        render: (_: any, r: any) => (
          <Tag color="cyan" style={{ fontSize: 13 }}>
            {formatAge(r.min_age_months)} - {formatAge(r.max_age_months)}
          </Tag>
        ),
      },
      {
        title: "Số mũi",
        dataIndex: "item_count",
        align: "center" as const,
        width: 90,
        render: (count: number) => (
          <Tag color="purple" icon={<MedicineBoxOutlined />}>
            {count || 0} mũi
          </Tag>
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
        width: 100,
        align: "right" as const,
        render: (_: any, record: any) => (
          <Space>
            <Tooltip title="Sửa">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleShowForm(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Xóa phác đồ này?"
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
          padding: "12px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Card variant="outlined" styles={{ body: { padding: 0 } }}>
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
              <MedicineBoxOutlined /> Phác đồ Tiêm chủng Mẫu
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleShowForm()}
            >
              Tạo Phác đồ Mới
            </Button>
          </div>

          <div
            style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0" }}
          >
            <Row gutter={16}>
              <Col flex="auto">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo tên phác đồ..."
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
                  <Select.Option value="active">Đang áp dụng</Select.Option>
                  <Select.Option value="inactive">Ngừng áp dụng</Select.Option>
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

  const renderFormView = () => (
    <Form form={form} layout="vertical" onFinish={handleSave}>
      <Affix offsetTop={0} style={{ zIndex: 99 }}>
        <div style={{ ...styles.affixCard, padding: "12px 24px" }}>
          <Row
            justify="space-between"
            align="middle"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            <Col>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
                  Quay lại
                </Button>
                <Divider type="vertical" />
                <Title level={5} style={{ margin: 0 }}>
                  {editingTemplate
                    ? `Cập nhật: ${editingTemplate.data.name}`
                    : "Tạo Phác đồ Mới"}
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
                Lưu Phác đồ
              </Button>
            </Col>
          </Row>
        </div>
      </Affix>

      <Content style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        <Card
          variant="outlined"
          style={{ marginBottom: 24 }}
          title={
            <Space>
              <InfoCircleOutlined /> Thông tin Chung
            </Space>
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên Phác đồ"
                rules={[{ required: true }]}
              >
                <Input placeholder="Vd: Phác đồ HPV (9 chủng)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Mô tả">
                <Input placeholder="Mô tả ngắn gọn..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minAgeMonths" label="Tuổi tối thiểu (Tháng)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxAgeMonths" label="Tuổi tối đa (Tháng)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Trạng thái" initialValue="active">
                <Select>
                  <Option value="active">Hoạt động</Option>
                  <Option value="inactive">Ẩn</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          variant="outlined"
          title={
            <Space>
              <FieldTimeOutlined /> Lịch Tiêm chủng
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <DebounceProductSelect
              placeholder="🔍 Tìm vắc-xin để thêm vào lịch..."
              searchTypes={["product"]}
              value={selectValue}
              onChange={handleSelectProduct}
              style={{ width: "100%" }}
            />
          </div>
          <Form.List name="schedules">
            {(fields, { remove }) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    style={styles.formListCard}
                    variant="outlined"
                  >
                    <Row gutter={12} align="middle">
                      <Col flex="auto">
                        {/* FIX LỖI 2: Xóa {...field} để tránh cảnh báo key */}
                        <Form.Item
                          name={[field.name, "product_name"]}
                          label="Vắc-xin"
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            variant="borderless"
                            readOnly
                            style={{
                              fontWeight: 600,
                              color: "#1677ff",
                              paddingLeft: 0,
                            }}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, "product_id"]} hidden>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col flex="150px">
                        <Form.Item
                          name={[field.name, "shotName"]}
                          label="Tên mũi"
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col flex="120px">
                        <Form.Item
                          name={[field.name, "daysAfterStart"]}
                          label="Ngày thứ"
                          rules={[{ required: true }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={0} addonAfter="Ngày" />
                        </Form.Item>
                      </Col>
                      <Col flex="200px">
                        <Form.Item
                          name={[field.name, "note"]}
                          label="Ghi chú"
                          style={{ marginBottom: 0 }}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col flex="32px">
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
                  <Empty description="Chưa có mũi tiêm nào. Hãy tìm vắc-xin ở trên để thêm." />
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

export default VaccinationTemplatePage;
