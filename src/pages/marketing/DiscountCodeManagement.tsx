// src/pages/marketing/DiscountCodeManagement.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  TagOutlined,
  UserOutlined,
  GlobalOutlined,
  ReloadOutlined,
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
  Modal,
  Form,
  InputNumber,
  Divider,
  Tooltip,
  Popconfirm,
  DatePicker,
  Radio,
  QRCode,
  Tabs,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import { useState, useEffect } from "react";

// Import Store & Components
import DebounceCustomerSelect from "@/shared/ui/common/DebounceCustomerSelect";
import { useProductStore } from "@/features/inventory/stores/productStore";
import {
  usePromotionStore,
  Promotion,
} from "@/features/marketing/stores/usePromotionStore";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: { margin: "12px", border: "1.5px solid #d0d7de", borderRadius: "8px" },
  table: {
    border: "1.5px solid #d0d7de",
    borderRadius: "6px",
    overflow: "hidden",
  },
};

const DiscountCodeManagement = () => {
  const {
    promotions,
    loading,
    fetchPromotions,
    createPromotion,
    deletePromotion,
  } = usePromotionStore();
  // Lấy dữ liệu Nhóm hàng/Hãng từ ProductStore
  const { uniqueCategories, uniqueManufacturers, fetchClassifications } =
    useProductStore();

  // State Modal & Form
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState("");

  // State điều khiển UI Form
  const [discountType, setDiscountType] = useState("percent");
  const [promoType, setPromoType] = useState("public");
  const [scopeType, setScopeType] = useState("all");

  // --- STATE TÌM KIẾM & LỌC (MỚI THÊM) ---
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );

  const [form] = Form.useForm();

  // Effect 1: Tải dữ liệu ban đầu & danh mục
  useEffect(() => {
    fetchClassifications();
  }, []);

  // Effect 2: Gọi API tìm kiếm khi search/filter thay đổi (MỚI)
  useEffect(() => {
    fetchPromotions(searchText, statusFilter);
  }, [searchText, statusFilter]);

  const showAddModal = () => {
    setDiscountType("percent");
    setPromoType("public");
    setScopeType("all");
    form.resetFields();
    form.setFieldsValue({
      type: "public",
      discount_type: "percent",
      status: "active",
      apply_to_scope: "all",
      validDates: [dayjs(), dayjs().add(30, "day")],
      maxUsage: 100,
    });
    setIsModalVisible(true);
  };

  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        code: values.code,
        name: values.campaignName,
        description: values.description,
        type: values.type,
        discount_type: values.discount_type,
        discount_value: values.value,
        max_discount_value:
          values.discount_type === "percent" ? values.max_discount_value : null,
        min_order_value: values.minPurchase || 0,
        total_usage_limit: values.maxUsage,
        customer_ids: values.type === "personal" ? values.customer_ids : null,
        apply_to_scope: values.apply_to_scope,
        apply_to_ids: values.apply_to_ids ? [values.apply_to_ids] : [],
        valid_from: values.validDates[0].toISOString(),
        valid_to: values.validDates[1].toISOString(),
        status: values.status,
      };

      const success = await createPromotion(payload);
      if (success) setIsModalVisible(false);
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const generateRandomCode = () => {
    const randomCode = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();
    form.setFieldsValue({ code: randomCode });
  };

  const columns = [
    {
      title: "Mã Code",
      dataIndex: "code",
      render: (text: string) => (
        <Text strong copyable>
          {text}
        </Text>
      ),
    },
    {
      title: "Chiến dịch",
      dataIndex: "name",
    },
    {
      title: "Loại",
      dataIndex: "type",
      align: "center" as const,
      render: (type: string) =>
        type === "public" ? (
          <Tag icon={<GlobalOutlined />} color="blue">
            Công khai
          </Tag>
        ) : (
          <Tag icon={<UserOutlined />} color="purple">
            Cá nhân
          </Tag>
        ),
    },
    {
      title: "Phạm vi",
      dataIndex: "apply_to_scope",
      render: (scope: string) => {
        switch (scope) {
          case "all":
            return <Tag>Toàn sàn</Tag>;
          case "category":
            return <Tag color="cyan">Theo Nhóm</Tag>;
          case "brand":
            return <Tag color="orange">Theo Hãng</Tag>;
          default:
            return scope;
        }
      },
    },
    {
      title: "Giá trị",
      render: (_: any, record: Promotion) => (
        <Tag color={record.discount_type === "percent" ? "orange" : "green"}>
          {record.discount_type === "percent"
            ? `Giảm ${record.discount_value}%`
            : `Giảm ${record.discount_value.toLocaleString()}đ`}
        </Tag>
      ),
    },
    {
      title: "Đã dùng",
      render: (_: any, record: Promotion) => (
        <Text>
          {record.usage_count} / {record.total_usage_limit || "∞"}
        </Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      render: (status: string) => (
        <Tag color={status === "active" ? "success" : "default"}>
          {status === "active" ? "Hiệu lực" : "Hết hạn/Ẩn"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      align: "center" as const,
      render: (_: any, record: Promotion) => (
        <Space>
          <Tooltip title="QR Code">
            <Button
              icon={<QrcodeOutlined />}
              size="small"
              onClick={() => {
                setQrCodeValue(record.code);
                setIsQrModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm title="Xóa?" onConfirm={() => deletePromotion(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={styles.layout}>
        <Content>
          <Card bordered={false} style={styles.card} bodyStyle={{ padding: 0 }}>
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
                <TagOutlined /> Quản lý Mã Giảm giá & QR Code
              </Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showAddModal}
              >
                Thêm Mã Mới
              </Button>
            </div>

            {/* --- THANH TÌM KIẾM & BỘ LỌC (MỚI THÊM) --- */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <Row gutter={16}>
                <Col flex="auto">
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Tìm theo Mã Code, Tên chiến dịch..."
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
                    <Select.Option value="active">Hiệu lực</Select.Option>
                    <Select.Option value="inactive">Hết hạn/Ẩn</Select.Option>
                  </Select>
                </Col>
              </Row>
            </div>

            <Table
              columns={columns}
              dataSource={promotions}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10, size: "small" }}
            />
          </Card>
        </Content>
      </Layout>

      {/* Modal Thêm Mã */}
      <Modal
        title="Tạo Mã Giảm Giá Mới"
        open={isModalVisible}
        onOk={handleModalSave}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        destroyOnClose
        okText="Lưu & Kích hoạt"
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(v) => {
            if (v.discount_type) setDiscountType(v.discount_type);
            if (v.type) setPromoType(v.type);
            if (v.apply_to_scope) setScopeType(v.apply_to_scope);
          }}
        >
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: "1",
                label: "Cấu hình Cơ bản",
                children: (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="campaignName"
                        label="Tên Chiến dịch"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="Vd: Khuyến mãi Hè 2025" />
                      </Form.Item>
                      <Form.Item
                        name="code"
                        label="Mã Code (Voucher)"
                        rules={[{ required: true }]}
                        help="Mã khách hàng sẽ nhập."
                      >
                        <Input
                          placeholder="Vd: HE2025"
                          addonAfter={
                            <ReloadOutlined
                              onClick={generateRandomCode}
                              style={{ cursor: "pointer" }}
                            />
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        name="validDates"
                        label="Thời gian hiệu lực"
                        rules={[{ required: true }]}
                      >
                        <RangePicker
                          showTime
                          format="DD/MM/YYYY HH:mm"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Card
                        size="small"
                        title="Giá trị khuyến mãi"
                        style={{ backgroundColor: "#f9f9f9" }}
                      >
                        <Form.Item label="Loại giảm giá" required>
                          <Input.Group compact>
                            <Form.Item name="discount_type" noStyle>
                              <Select style={{ width: "40%" }}>
                                <Option value="percent">Giảm %</Option>
                                <Option value="fixed">Tiền mặt</Option>
                              </Select>
                            </Form.Item>
                            <Form.Item
                              name="value"
                              noStyle
                              rules={[{ required: true }]}
                            >
                              <InputNumber
                                style={{ width: "60%" }}
                                min={0}
                                formatter={(value) =>
                                  `${value}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ","
                                  )
                                }
                              />
                            </Form.Item>
                          </Input.Group>
                        </Form.Item>

                        {discountType === "percent" && (
                          <Form.Item
                            name="max_discount_value"
                            label="Giảm tối đa (VNĐ)"
                          >
                            <InputNumber
                              style={{ width: "100%" }}
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              addonAfter="đ"
                            />
                          </Form.Item>
                        )}

                        <Form.Item
                          name="minPurchase"
                          label="Đơn hàng tối thiểu"
                          initialValue={0}
                        >
                          <InputNumber
                            style={{ width: "100%" }}
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            addonAfter="đ"
                          />
                        </Form.Item>

                        <Form.Item
                          name="maxUsage"
                          label="Giới hạn lượt dùng"
                          initialValue={100}
                        >
                          <InputNumber
                            min={1}
                            style={{ width: "100%" }}
                            addonAfter="lượt"
                          />
                        </Form.Item>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
              {
                key: "2",
                label: "Phạm vi & Đối tượng",
                children: (
                  <>
                    <Form.Item
                      name="type"
                      label="Đối tượng khách hàng"
                      rules={[{ required: true }]}
                    >
                      <Radio.Group buttonStyle="solid">
                        <Radio.Button value="public">
                          <GlobalOutlined /> Công khai
                        </Radio.Button>
                        <Radio.Button value="personal">
                          <UserOutlined /> Tặng Riêng (VIP)
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {promoType === "personal" && (
                      <Form.Item
                        name="customer_ids"
                        label="Chọn Khách hàng (Có thể chọn nhiều)"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn ít nhất 1 khách hàng",
                          },
                        ]}
                        help="Hệ thống sẽ tự động tạo mã riêng cho từng khách hàng."
                      >
                        <DebounceCustomerSelect />
                      </Form.Item>
                    )}

                    <Divider />

                    <Form.Item
                      name="apply_to_scope"
                      label="Phạm vi sản phẩm áp dụng"
                    >
                      <Radio.Group>
                        <Radio value="all">Toàn bộ đơn hàng</Radio>
                        <Radio value="category">Theo Nhóm hàng</Radio>
                        <Radio value="brand">Theo Nhà sản xuất</Radio>
                      </Radio.Group>
                    </Form.Item>

                    {scopeType === "category" && (
                      <Form.Item
                        name="apply_to_ids"
                        label="Chọn Nhóm hàng"
                        rules={[{ required: true }]}
                      >
                        <Select
                          placeholder="Chọn nhóm hàng..."
                          showSearch
                          optionFilterProp="children"
                        >
                          {uniqueCategories.map((cat) => (
                            <Option key={cat} value={cat}>
                              {cat}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                    {scopeType === "brand" && (
                      <Form.Item
                        name="apply_to_ids"
                        label="Chọn Hãng sản xuất"
                        rules={[{ required: true }]}
                      >
                        <Select
                          placeholder="Chọn hãng sản xuất..."
                          showSearch
                          optionFilterProp="children"
                        >
                          {uniqueManufacturers.map((man) => (
                            <Option key={man} value={man}>
                              {man}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                  </>
                ),
              },
            ]}
          />

          <Form.Item
            name="status"
            label="Trạng thái"
            initialValue="active"
            hidden
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal QR Code */}
      <Modal
        title="Quét mã để nhận ưu đãi"
        open={isQrModalVisible}
        onCancel={() => setIsQrModalVisible(false)}
        footer={null}
        width={300}
      >
        <div style={{ textAlign: "center", padding: 20 }}>
          <Space direction="vertical" align="center">
            <QRCode
              value={qrCodeValue}
              size={200}
              icon="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg"
            />
            <Title level={3} style={{ margin: 0 }}>
              {qrCodeValue}
            </Title>
            <Text type="secondary">Đưa mã này cho thu ngân</Text>
          </Space>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default DiscountCodeManagement;
