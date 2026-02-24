// src/pages/crm/CustomerSegmentsPage.tsx
//import React from "react";
import {
  PlusOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Row,
  Col,
  List,
  Button,
  Tag,
  Space,
  Typography,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Empty,
} from "antd";

import { CriteriaBuilder } from "../../features/crm/components/segmentation/CriteriaBuilder";
import { useSegmentManagement } from "../../features/crm/hooks/useSegmentManagement";

const { Content } = Layout;
const { Text } = Typography;

const CustomerSegmentsPage = () => {
  const {
    segments,
    members,
    loading,
    loadingMembers,
    isModalOpen,
    setIsModalOpen,
    editingSegment,
    selectedSegmentId,
    setSelectedSegmentId,
    form,
    handleCreateOrUpdate,
    handleDelete,
    handleManualRefresh,
    openCreateModal,
    openEditModal,
  } = useSegmentManagement();

  const segmentType = Form.useWatch("type", form);

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{
          padding: 24,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Row gutter={24} style={{ flex: 1, minHeight: 0 }}>
          {/* CỘT TRÁI: DANH SÁCH NHÓM */}
          <Col
            span={8}
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <Card
              title="Phân Khúc Khách Hàng"
              extra={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                >
                  Tạo mới
                </Button>
              }
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
              styles={{ body: { flex: 1, overflowY: "auto", padding: 12 } }}
            >
              <List
                dataSource={segments}
                loading={loading}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      background:
                        selectedSegmentId === item.id ? "#e6f7ff" : "#fff",
                      borderRadius: 8,
                      padding: "12px 16px",
                      marginBottom: 8,
                      border: "1px solid #f0f0f0",
                      transition: "all 0.2s",
                    }}
                    onClick={() => setSelectedSegmentId(item.id)}
                    actions={[
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(item);
                        }}
                      />,
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        item.type === "dynamic" ? (
                          <RobotOutlined
                            style={{ fontSize: 24, color: "#1890ff" }}
                          />
                        ) : (
                          <UsergroupAddOutlined
                            style={{ fontSize: 24, color: "#52c41a" }}
                          />
                        )
                      }
                      title={
                        <Space>
                          <Text strong>{item.name}</Text>
                          {!item.is_active && <Tag color="error">Tắt</Tag>}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.description || "Chưa có mô tả"}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* CỘT PHẢI: CHI TIẾT THÀNH VIÊN */}
          <Col span={16} style={{ height: "100%" }}>
            {selectedSegmentId ? (
              <Card
                title={
                  <Space>
                    <span>Danh sách thành viên</span>
                    <Tag color="blue">{members.length} khách</Tag>
                  </Space>
                }
                extra={
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => handleManualRefresh(selectedSegmentId)}
                    loading={loadingMembers}
                  >
                    Quét lại danh sách
                  </Button>
                }
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                styles={{ body: { flex: 1, overflow: "hidden" } }}
              >
                <Table
                  dataSource={members}
                  rowKey="id"
                  loading={loadingMembers}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ y: "calc(100vh - 250px)" }}
                  columns={[
                    {
                      title: "Tên khách hàng",
                      dataIndex: "name",
                      render: (t) => <Text strong>{t}</Text>,
                    },
                    { title: "SĐT", dataIndex: "phone" },
                    {
                      title: "Giới tính",
                      dataIndex: "gender",
                      width: 100,
                      align: "center",
                    },
                    {
                      title: "Điểm",
                      dataIndex: "loyalty_points",
                      align: "right",
                      render: (v) => (
                        <Text type="success" strong>
                          {v}
                        </Text>
                      ),
                    },
                    {
                      title: "Ngày tham gia",
                      dataIndex: "added_at",
                      width: 150,
                      align: "right",
                      render: (d) => new Date(d).toLocaleDateString("vi-VN"),
                    },
                  ]}
                />
              </Card>
            ) : (
              <div
                style={{
                  height: "100%",
                  background: "#fff",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Empty
                  description="Chọn một nhóm để xem chi tiết"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Col>
        </Row>

        {/* MODAL CỦA AURA */}
        <Modal
          title={editingSegment ? "Chỉnh sửa Phân khúc" : "Tạo Phân khúc Mới"}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
          confirmLoading={loading}
          destroyOnClose
        >
          <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="name"
                  label="Tên nhóm"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="VD: Khách Vip sinh nhật tháng 5" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="type" label="Loại nhóm">
                  <Select disabled={!!editingSegment}>
                    <Select.Option value="dynamic">
                      {" "}
                      Tự động (Auto)
                    </Select.Option>
                    <Select.Option value="static">
                      Thủ Công (Manual)
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea
                rows={2}
                placeholder="Mô tả mục đích nhóm này..."
              />
            </Form.Item>

            {/* Gọi Component Atomic */}
            {segmentType === "dynamic" && (
              <Form.Item name="criteria" noStyle>
                <CriteriaBuilder />
              </Form.Item>
            )}

            <div style={{ marginTop: 16 }}>
              <Form.Item
                name="is_active"
                valuePropName="checked"
                style={{ marginBottom: 0 }}
              >
                <Switch
                  checkedChildren="Đang hoạt động"
                  unCheckedChildren="Tạm dừng"
                />
              </Form.Item>
            </div>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default CustomerSegmentsPage;
