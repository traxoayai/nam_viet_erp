// src/pages/marketing/DiscountCodeManagement.tsx
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  TagOutlined,
  UserOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Divider,
  Row,
  Col,
  ConfigProvider,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
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

import DebounceCustomerSelect from "@/components/common/DebounceCustomerSelect";
import { useProductStore } from "@/stores/productStore";
import { usePromotionStore, Promotion } from "@/stores/usePromotionStore";

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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState("");
  // MỚI: Lấy danh sách Nhóm & Hãng từ Store
  const { uniqueCategories, uniqueManufacturers, fetchClassifications } =
    useProductStore();

  // State điều khiển UI Form
  const [discountType, setDiscountType] = useState("percent");
  const [promoType, setPromoType] = useState("public");
  const [scopeType, setScopeType] = useState("all"); // all | category | brand

  const [form] = Form.useForm();

  useEffect(() => {
    fetchPromotions();
    fetchClassifications();
  }, []);

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

      // Xử lý dữ liệu trước khi gửi
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

        // Xử lý khách hàng (Nếu chọn nhiều -> Gửi mảng ID)
        // Nếu type = personal, values.customer_ids sẽ là mảng UUID
        customer_ids: values.type === "personal" ? values.customer_ids : null,

        // Xử lý phạm vi
        apply_to_scope: values.apply_to_scope,
        // Lưu ID của danh mục/brand vào JSON (ở đây demo nhập text, thực tế nên là Select)
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
            return <Tag color="cyan">Theo Nhóm hàng</Tag>;
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
          <Card
            bordered={false}
            style={styles.card}
            bodyStyle={{ padding: 16 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
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

            <div style={styles.table}>
              <Table
                columns={columns}
                dataSource={promotions}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10, size: "small" }}
                size="small"
              />
            </div>
          </Card>
        </Content>
      </Layout>

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
                          <GlobalOutlined /> Công khai (Ai cũng dùng được)
                        </Radio.Button>
                        <Radio.Button value="personal">
                          <UserOutlined /> Tặng Riêng (Specific User)
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {/* NÂNG CẤP: Chọn nhiều khách hàng */}
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
                        help="Hệ thống sẽ tự động tạo các mã riêng biệt cho từng khách hàng được chọn (VD: HE2025-1, HE2025-2...)"
                      >
                        <DebounceCustomerSelect />
                        {/* Lưu ý: DebounceCustomerSelect cần hỗ trợ mode="multiple" trong file gốc */}
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

                    {/* NÂNG CẤP: UI Chọn Phạm vi (Dữ liệu Thật) */}
                    {scopeType === "category" && (
                      <Form.Item
                        name="apply_to_ids"
                        label="Chọn Nhóm hàng"
                        rules={[{ required: true }]}
                      >
                        <Select
                          placeholder="Chọn nhóm hàng..."
                          showSearch // Cho phép gõ để tìm
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
                          showSearch // Cho phép gõ để tìm
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
            label="Trạng thái kích hoạt"
            initialValue="active"
            hidden
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal QR Code Native (Fix Lỗi 1) */}
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
            <Text type="secondary">Đưa mã này cho nhân viên thu ngân</Text>
          </Space>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default DiscountCodeManagement;
