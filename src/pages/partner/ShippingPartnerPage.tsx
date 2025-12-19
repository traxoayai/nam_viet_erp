// src/pages/partner/ShippingPartnerPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TruckOutlined,
  MobileOutlined,
  CarOutlined,
  UserOutlined,
  MinusCircleOutlined,
  FieldTimeOutlined,
  //   DollarCircleOutlined,
  SafetyOutlined,
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
  App as AntApp,
  Tooltip,
  Popconfirm,
  TimePicker,
  InputNumber,
  Divider,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import "dayjs/locale/vi";
import dayjs from "dayjs";
import React, { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

import type { TableProps } from "antd";

// IMPORT "BỘ NÃO" VÀ "KHUÔN MẪU"
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useShippingPartnerStore } from "@/features/partners/stores/useShippingPartnerStore";
import {
  ShippingPartnerListRecord,
  ShippingPartnerFormData,
  //   ShippingRule,
  ShippingPartnerStatus,
  ShippingPartnerType,
} from "@/features/partners/types/shippingPartner";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
// const { Option } = Select;
// const { TextArea } = Input;

// --- CSS INLINE (Style từ Canvas) ---
const styles = {
  card: {
    margin: "12px",
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
  formListCard: {
    border: "1.5px dashed #d0d7de",
    backgroundColor: "#fcfcfc",
    marginBottom: 12,
  },
};

// --- HÀM TĨNH (Từ Canvas) ---
const partnerTypeMap = {
  app: { text: "App Giao hàng", color: "blue", icon: <MobileOutlined /> },
  coach: { text: "Xe khách/Chành xe", color: "purple", icon: <CarOutlined /> },
  internal: {
    text: "Nội bộ (Tự giao)",
    color: "default",
    icon: <UserOutlined />,
  },
};
const statusMap = {
  active: { text: "Đang hợp tác", color: "success" },
  inactive: { text: "Ngừng hợp tác", color: "default" },
};

// --- HÀM HỖ TRỢ (Từ Canvas) ---
const currencyFormatter = (value: string | number | undefined | null) => {
  const stringValue = String(value);
  if (value === undefined || value === null || stringValue === "") return "0 đ";
  return (
    `${stringValue.replace(/\đ\s?|(,*)/g, "")}`.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ","
    ) + " đ"
  );
};
const currencyParser = (value: string | undefined) => {
  if (!value) return "0";
  return value.replace(/\đ\s?|(,*)/g, "");
};

// --- COMPONENT CHÍNH ---
const ShippingPartnerPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage, modal: antModal } = AntApp.useApp(); // Lấy state từ "bộ não"
  const {
    partners,
    loading,
    loadingDetails,
    isModalVisible,
    editingPartner,
    fetchPartners,
    createPartner,
    updatePartner,
    deletePartner,
    reactivatePartner,
    showModal,
    closeModal,
  } = useShippingPartnerStore(); // State cục bộ

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  const isNew = !editingPartner; // Tải danh sách

  const loadPartners = useCallback(() => {
    fetchPartners({ search_query: debouncedSearch });
  }, [fetchPartners, debouncedSearch]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]); // Điền form khi dữ liệu Sửa về

  useEffect(() => {
    if (isModalVisible) {
      if (!isNew && editingPartner && !loadingDetails) {
        const partner = editingPartner.partner;
        form.setFieldsValue({
          ...partner,
          cutOffTime: partner.cut_off_time
            ? dayjs(partner.cut_off_time, "HH:mm:ss")
            : null,
          deliveryRules: (editingPartner.rules || []).map((r) => ({
            ...r,
            key: uuidv4(),
          })),
        });
      } else if (isNew) {
        form.resetFields();
        form.setFieldsValue({
          status: "active",
          type: "app",
          deliveryRules: [],
          cutOffTime: dayjs("16:00", "HH:mm"),
        });
      }
    }
  }, [isModalVisible, isNew, editingPartner, loadingDetails, form]);

  const handleSave = async () => {
    const msgKey = "save_partner";
    try {
      const values = await form.validateFields();
      antMessage.loading({ content: "Đang xử lý...", key: msgKey });

      const partnerData: ShippingPartnerFormData = {
        name: values.name,
        type: values.type,
        contact_person: values.contact_person,
        phone: values.phone,
        email: values.email,
        address: values.address,
        notes: values.notes,
        status: values.status,
        cut_off_time: values.cutOffTime
          ? values.cutOffTime.format("HH:mm:ss")
          : null,
        speed_hours: 24, // Mặc định 24h
        base_fee: 0, // Mặc định 0đ
      };
      const rulesData = (values.deliveryRules || []).map((r: any) => ({
        zone_name: r.zone_name,
        speed_hours: r.speed_hours,
        fee: r.fee,
      }));

      if (isNew) {
        await createPartner(partnerData, rulesData);
        antMessage.success({
          content: `Thêm đối tác "${values.name}" thành công!`,
          key: msgKey,
        });
      } else {
        await updatePartner(editingPartner!.partner.id, partnerData, rulesData);
        antMessage.success({
          content: `Cập nhật đối tác "${values.name}" thành công!`,
          key: msgKey,
        });
      } // Store đã tự đóng Modal
    } catch (error: any) {
      console.error("Lỗi Save:", error);
      antMessage.error({
        content: `Lưu thất bại: ${error.message}`,
        key: msgKey,
      });
    }
  };

  const handleDelete = async (record: ShippingPartnerListRecord) => {
    antModal.confirm({
      title: `Ngừng Hợp tác với "${record.name}"?`,
      onOk: async () => {
        try {
          await deletePartner(record.id);
          antMessage.success("Đã cập nhật trạng thái.");
        } catch (error: any) {
          antMessage.error(error.message);
        }
      },
    });
  };
  const handleReactivate = async (record: ShippingPartnerListRecord) => {
    try {
      await reactivatePartner(record.id);
      antMessage.success(`Đã hợp tác trở lại với "${record.name}".`);
    } catch (error: any) {
      antMessage.error(error.message);
    }
  }; // --- GIAO DIỆN (Views) ---
  // 1. Giao diện Danh sách (List View)
  const columns: TableProps<ShippingPartnerListRecord>["columns"] = [
    {
      title: "Tên Đối tác Vận Chuyển",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Loại Đối tác",
      dataIndex: "type",
      key: "type",
      width: 180,
      align: "center",
      render: (type: ShippingPartnerType) => {
        const typeInfo = partnerTypeMap[type] || {};
        return (
          <Tag icon={typeInfo.icon} color={typeInfo.color}>
            {typeInfo.text}
          </Tag>
        );
      },
      filters: Object.keys(partnerTypeMap).map((key) => ({
        text: partnerTypeMap[key as ShippingPartnerType].text,
        value: key,
      })),
      onFilter: (value: any, record) => record.type === value,
    },
    {
      title: "Giờ Cut-off",
      dataIndex: "cut_off_time",
      key: "cut_off_time",
      width: 120,
      align: "center",
      render: (time: string) =>
        time ? (
          <Tag icon={<FieldTimeOutlined />}>
            {dayjs(time, "HH:mm:ss").format("HH:mm")}
          </Tag>
        ) : (
          "N/A"
        ),
    },
    {
      title: "Người liên hệ",
      dataIndex: "contact_person",
      key: "contact_person",
      width: 200,
    },
    { title: "Số điện thoại", dataIndex: "phone", key: "phone", width: 150 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      align: "center",
      render: (status: ShippingPartnerStatus) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
      filters: Object.keys(statusMap).map((key) => ({
        text: statusMap[key as ShippingPartnerStatus].text,
        value: key,
      })),
      onFilter: (value: any, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      width: 120,
      align: "center",
      fixed: "right",
      render: (_: any, record: ShippingPartnerListRecord) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
            />
          </Tooltip>
          {record.status === "active" ? (
            <Tooltip title="Ngừng Hợp tác">
              <Popconfirm
                title={`Ngừng hợp tác với "${record.name}"?`}
                onConfirm={() => handleDelete(record)}
                okText="Đồng ý"
                cancelText="Hủy"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="Hợp tác trở lại">
              <Button
                type="text"
                style={{ color: "green" }}
                icon={<SafetyOutlined />}
                onClick={() => handleReactivate(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]; // --- GIAO DIỆN (JSX) ---

  return (
    <ConfigProvider locale={viVN}>
      {/* CSS cho Table Header */}
      <style>{`
  .ant-table-thead > tr > th {
 border-bottom: 1.5px solid #d0d7de !important;
 background-color: #f6f8fa !important;
  }
  `}</style>
      <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
        <Content style={{ padding: "0 10px" }}>
          <Card style={styles.card} styles={{ body: { padding: "16px" } }}>
            <Spin spinning={loading} tip="Đang tải...">
              {/* Phần 1: Header - Tiêu đề và Nút bấm */}
              <Row
                justify="space-between"
                align="middle"
                style={{ marginBottom: "16px" }}
              >
                <Col>
                  <Title level={4} style={{ margin: 0 }}>
                    <TruckOutlined /> Quản lý Đối tác Vận Chuyển
                  </Title>

                  <Text type="secondary">
                    Quản lý hồ sơ GHTK, GHN, Xe khách...
                  </Text>
                </Col>
                <Col>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => showModal()}
                  >
                    Thêm Đối tác
                  </Button>
                </Col>
              </Row>
              {/* Phần 2: Bộ lọc */}
              <Row gutter={16} style={{ marginBottom: "16px" }}>
                <Col flex="auto">
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Tìm theo tên đối tác, SĐT, người liên hệ..."
                    allowClear
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </Col>
                <Col flex="200px">
                  <Select
                    placeholder="Lọc theo Loại đối tác"
                    allowClear
                    style={{ width: "100%" }}
                    options={Object.keys(partnerTypeMap).map((key) => ({
                      value: key,
                      label: partnerTypeMap[key as ShippingPartnerType].text,
                    }))}
                    onChange={(val) => fetchPartners({ type_filter: val })}
                  />
                </Col>
              </Row>
              {/* Phần 3: Bảng dữ liệu */}
              <Table
                columns={columns}
                dataSource={partners}
                bordered
                rowKey="key"
                pagination={false} // Tắt phân trang (theo Canvas)
                scroll={{ x: 1000 }}
              />
            </Spin>
          </Card>
        </Content>
        {/* Modal Thêm/Sửa */}
        <Modal
          title={
            <Title level={4} style={{ margin: 0 }}>
              {isNew
                ? "Thêm Đối tác Vận Chuyển Mới"
                : `Sửa Đối tác: ${form.getFieldValue("name") || "..."}`}
            </Title>
          }
          open={isModalVisible}
          onCancel={closeModal}
          onOk={handleSave}
          okText="Lưu Đối tác"
          cancelText="Hủy"
          width={800}
          confirmLoading={loading} // Nút Save sẽ xoay
          destroyOnHidden
        >
          <Spin spinning={loadingDetails} tip="Đang tải chi tiết...">
            <Form form={form} layout="vertical">
              <Title level={5}>Thông tin Cơ bản</Title>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="Tên Đối tác Vận Chuyển"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Vd: Giao Hàng Tiết Kiệm" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="type"
                    label="Phân loại"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={Object.keys(partnerTypeMap).map((key) => ({
                        value: key,
                        label: partnerTypeMap[key as ShippingPartnerType].text,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="contact_person"
                    label="Người liên hệ"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Vd: Anh Hùng (Bưu cục)" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="Số điện thoại"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="SĐT của người liên hệ hoặc hotline" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="Email (Nếu có)">
                    <Input placeholder="Vd: hotro@ghtk.vn" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="status"
                    label="Trạng thái"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={Object.keys(statusMap).map((key) => ({
                        value: key,
                        label: statusMap[key as ShippingPartnerStatus].text,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="address" label="Địa chỉ (Bưu cục/Văn phòng)">
                    <Input placeholder="Địa chỉ liên hệ/gửi hàng..." />
                  </Form.Item>
                </Col>
              </Row>
              <Divider />
              <div>
                <Title level={5}>Nghiệp vụ Giao vận (Logistics)</Title>
              </div>
              <Form.Item
                name="cut_off_time"
                label="Giờ Cut-off Lấy hàng"
                tooltip="Đơn hàng tạo sau giờ này sẽ được tính là đơn của ngày hôm sau."
              >
                <TimePicker format="HH:mm" style={{ width: 150 }} />
              </Form.Item>
              <Paragraph strong>Bảng quy tắc Vùng & Tốc độ</Paragraph>
              <Form.List name="deliveryRules">
                {(fields, { add, remove }) => (
                  <div style={{ marginTop: 12 }}>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        style={styles.formListCard}
                        styles={{ body: { padding: "12px 16px" } }}
                        extra={
                          <Tooltip title="Xóa Quy tắc">
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(name)}
                            />
                          </Tooltip>
                        }
                      >
                        <Row gutter={16}>
                          <Col xs={24} md={10}>
                            <Form.Item
                              {...restField}
                              name={[name, "zone_name"]}
                              label="Tên Vùng Giao hàng"
                              rules={[
                                { required: true, message: "Nhập tên vùng!" },
                              ]}
                            >
                              <Input placeholder="Vd: Nội thành HN" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={7}>
                            <Form.Item
                              {...restField}
                              name={[name, "speed_hours"]}
                              label="Tốc độ (Giờ)"
                              rules={[{ required: true, message: "Nhập giờ!" }]}
                            >
                              <InputNumber
                                min={1}
                                addonAfter="Giờ"
                                style={{ width: "100%" }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={7}>
                            <Form.Item
                              {...restField}
                              name={[name, "fee"]}
                              label="Phí (Tham khảo)"
                            >
                              <InputNumber
                                formatter={currencyFormatter}
                                parser={
                                  currencyParser as (
                                    value: string | undefined
                                  ) => string
                                } // Ép kiểu parser
                                addonAfter="đ"
                                style={{ width: "100%" }}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        Thêm Quy tắc Vùng & Tốc độ
                      </Button>
                    </Form.Item>
                  </div>
                )}
              </Form.List>
            </Form>
          </Spin>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
};

export default ShippingPartnerPage;
