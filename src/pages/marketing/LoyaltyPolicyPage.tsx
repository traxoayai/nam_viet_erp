// src/pages/marketing/LoyaltyPolicyPage.tsx
import {
  SaveOutlined,
  CalculatorOutlined,
  GiftOutlined,
  PlusOutlined,
  DeleteOutlined,
  //   InfoCircleOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  ConfigProvider,
  Space,
  Form,
  InputNumber,
  message,
  Divider,
  Checkbox,
  Radio,
  Switch,
  Affix,
  Tooltip,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import { useEffect } from "react";

import { useLoyaltyStore } from "@/stores/useLoyaltyStore";
import { LoyaltyPolicy } from "@/types/loyalty";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const styles = {
  layout: {
    minHeight: "100vh",
    backgroundColor: "#f6f8fa",
  },
  card: {
    margin: "12px",
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
  innerCard: {
    marginBottom: "16px",
    border: "1.5px dashed #d0d7de",
    borderRadius: "6px",
    backgroundColor: "#fcfcfc",
  },
  affixCardBody: {
    padding: "12px 16px",
    borderTop: "1.5px solid #d0d7de",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(5px)",
  },
};

// Helper format tiền tệ
const currencyFormatter = (value: any) =>
  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
const currencyParser = (value: string | undefined) =>
  value ? value.replace(/đ\s?|(,*)/g, "") : "";

const LoyaltyPolicyPage = () => {
  const [form] = Form.useForm();
  const { policy, loading, fetchPolicy, savePolicy } = useLoyaltyStore();

  // Load dữ liệu khi vào trang
  useEffect(() => {
    fetchPolicy();
  }, []);

  // Đổ dữ liệu vào form khi policy thay đổi
  useEffect(() => {
    form.setFieldsValue(policy);
  }, [policy, form]);

  const onFinish = async (values: LoyaltyPolicy) => {
    const success = await savePolicy(values);
    if (success) {
      message.success("Đã lưu Chính sách Tích điểm & Đổi điểm thành công!");
    } else {
      message.error("Lưu thất bại, vui lòng thử lại.");
    }
  };

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={styles.layout}>
        <Spin spinning={loading} tip="Đang tải cấu hình...">
          <Content style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={policy}
            >
              <Card style={styles.card} styles={{ body: { padding: "24px" } }}>
                <div style={{ marginBottom: 24 }}>
                  <Title level={3} style={{ margin: 0 }}>
                    Thiết lập Chính sách Tích Điểm
                  </Title>
                  <Text type="secondary">
                    Cấu hình quy tắc khách hàng nhận điểm thưởng và đổi quà.
                  </Text>
                </div>

                {/* --- PHẦN 1: QUY TẮC TÍCH ĐIỂM --- */}
                <Divider orientation="left" plain>
                  <CalculatorOutlined />{" "}
                  <Text strong>1. Quy tắc Kiếm Điểm (Earning)</Text>
                </Divider>

                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Tỷ lệ quy đổi cơ bản"
                      required
                      tooltip="Khách hàng tiêu bao nhiêu tiền để nhận được điểm?"
                    >
                      <Input.Group compact>
                        <Form.Item
                          name="earnRateAmount"
                          noStyle
                          rules={[{ required: true, message: "Nhập số tiền" }]}
                        >
                          <InputNumber
                            style={{ width: "calc(50% - 15px)" }}
                            min={1000}
                            step={1000}
                            formatter={currencyFormatter}
                            parser={currencyParser}
                            addonAfter="đ"
                          />
                        </Form.Item>
                        <span
                          style={{
                            display: "inline-block",
                            width: "30px",
                            textAlign: "center",
                            lineHeight: "32px",
                          }}
                        >
                          =
                        </span>
                        <Form.Item
                          name="earnRatePoints"
                          noStyle
                          rules={[{ required: true, message: "Nhập điểm" }]}
                        >
                          <InputNumber
                            style={{ width: "calc(50% - 15px)" }}
                            min={1}
                            addonAfter="điểm"
                          />
                        </Form.Item>
                      </Input.Group>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="applyTo"
                      label="Áp dụng cho các kênh"
                      rules={[
                        { required: true, message: "Chọn ít nhất 1 kênh" },
                      ]}
                    >
                      <Checkbox.Group>
                        <Checkbox value="pos">Bán lẻ (POS)</Checkbox>
                        <Checkbox value="b2b">Bán Buôn (B2B)</Checkbox>
                        <Checkbox value="clinic">Phòng Khám/Dịch vụ</Checkbox>
                      </Checkbox.Group>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="pointExpiryType"
                      label="Hạn sử dụng điểm"
                      required
                    >
                      <Radio.Group>
                        <Radio
                          value="never"
                          style={{ display: "block", marginBottom: 8 }}
                        >
                          Không bao giờ hết hạn
                        </Radio>
                        <Radio value="duration" style={{ display: "block" }}>
                          <Space>
                            Hết hạn sau
                            <Form.Item
                              name="pointExpiryMonths"
                              noStyle
                              dependencies={["pointExpiryType"]}
                            >
                              {/* Logic render có điều kiện bên trong render props */}
                              {() => (
                                <InputNumber
                                  min={1}
                                  max={60}
                                  style={{ width: 70 }}
                                  disabled={
                                    form.getFieldValue("pointExpiryType") !==
                                    "duration"
                                  }
                                />
                              )}
                            </Form.Item>
                            tháng kể từ ngày nhận.
                          </Space>
                        </Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="earnOnDiscounted"
                      label="Quy tắc đặc biệt"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
                    </Form.Item>
                    <Text
                      type="secondary"
                      style={{ marginTop: -10, display: "block" }}
                    >
                      {form.getFieldValue("earnOnDiscounted")
                        ? "Đang BẬT: Khách vẫn được tích điểm cho các sản phẩm đã giảm giá."
                        : "Đang TẮT: Sản phẩm đã giảm giá sẽ không được tích thêm điểm."}
                    </Text>
                  </Col>
                </Row>

                {/* --- PHẦN 2: QUY TẮC ĐỔI ĐIỂM --- */}
                <Divider orientation="left" plain style={{ marginTop: 32 }}>
                  <GiftOutlined />{" "}
                  <Text strong>2. Quy tắc Đổi Điểm (Redeeming)</Text>
                </Divider>
                <Paragraph type="secondary">
                  Thiết lập các mốc điểm để khách hàng đổi lấy Voucher. Hệ thống
                  sẽ tự động sinh mã Voucher khi khách đổi.
                </Paragraph>

                <Form.List name="redeemTiers">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }, index) => (
                        <Card
                          key={key}
                          style={styles.innerCard}
                          size="small"
                          title={`Mốc đổi thưởng #${index + 1}`}
                          extra={
                            <Tooltip title="Xóa mốc này">
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                              />
                            </Tooltip>
                          }
                        >
                          <Row gutter={16}>
                            <Col xs={24} md={6}>
                              <Form.Item
                                {...restField}
                                name={[name, "pointsNeeded"]}
                                label="Điểm cần đổi"
                                rules={[
                                  { required: true, message: "Nhập điểm" },
                                ]}
                              >
                                <InputNumber
                                  style={{ width: "100%" }}
                                  min={1}
                                  step={100}
                                  addonAfter="điểm"
                                />
                              </Form.Item>
                            </Col>

                            {/* Dùng Form.Item dependencies để xử lý logic UI cho từng dòng */}
                            <Col xs={24} md={8}>
                              <Form.Item
                                noStyle
                                shouldUpdate={(prev, curr) =>
                                  prev.redeemTiers?.[name]?.voucherType !==
                                  curr.redeemTiers?.[name]?.voucherType
                                }
                              >
                                {({ getFieldValue }) => {
                                  const type = getFieldValue([
                                    "redeemTiers",
                                    name,
                                    "voucherType",
                                  ]);
                                  return (
                                    <Form.Item label="Giá trị Voucher" required>
                                      <Input.Group compact>
                                        <Form.Item
                                          {...restField}
                                          name={[name, "voucherType"]}
                                          noStyle
                                          initialValue="fixed"
                                        >
                                          <Select style={{ width: "35%" }}>
                                            <Option value="fixed">VNĐ</Option>
                                            <Option value="percent">%</Option>
                                          </Select>
                                        </Form.Item>
                                        <Form.Item
                                          {...restField}
                                          name={[name, "voucherValue"]}
                                          noStyle
                                          rules={[{ required: true }]}
                                        >
                                          <InputNumber
                                            style={{ width: "65%" }}
                                            min={1}
                                            formatter={
                                              type === "fixed"
                                                ? currencyFormatter
                                                : (v) => `${v}`
                                            }
                                            parser={
                                              type === "fixed"
                                                ? (currencyParser as any)
                                                : (v) => v
                                            }
                                            addonAfter={
                                              type === "fixed" ? "" : "%"
                                            }
                                          />
                                        </Form.Item>
                                      </Input.Group>
                                    </Form.Item>
                                  );
                                }}
                              </Form.Item>
                            </Col>

                            <Col xs={24} md={6}>
                              <Form.Item
                                {...restField}
                                name={[name, "voucherMinPurchase"]}
                                label="Đơn tối thiểu"
                                initialValue={0}
                              >
                                <InputNumber
                                  style={{ width: "100%" }}
                                  min={0}
                                  formatter={currencyFormatter}
                                  parser={currencyParser as any}
                                  addonAfter="đ"
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={4}>
                              <Form.Item
                                {...restField}
                                name={[name, "voucherExpiryDays"]}
                                label="HSD (Ngày)"
                                initialValue={30}
                                rules={[{ required: true }]}
                              >
                                <InputNumber
                                  min={1}
                                  style={{ width: "100%" }}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button
                        type="primary"
                        onClick={() => add()}
                        icon={<PlusOutlined />}
                      >
                        Thêm mốc đổi điểm mới
                      </Button>
                    </>
                  )}
                </Form.List>
              </Card>

              <Affix offsetBottom={0}>
                <Card bordered={false} bodyStyle={styles.affixCardBody}>
                  <Row justify="end">
                    <Col>
                      <Space>
                        <Button onClick={() => form.resetFields()}>
                          Khôi phục
                        </Button>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={loading}
                        >
                          Lưu Chính Sách
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
              </Affix>
            </Form>
          </Content>
        </Spin>
      </Layout>
    </ConfigProvider>
  );
};

export default LoyaltyPolicyPage;
