// src/pages/settings/WarehouseListPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  Space,
  Tag,
  Popconfirm,
  Modal,
  Form,
  App as AntApp,
  Spin,
  Tooltip,
  InputNumber,
} from "antd";
import React, { useState, useEffect } from "react";

import type { TableProps } from "antd";

import { useDebounce } from "@/shared/hooks/useDebounce";
import { useWarehouseStore } from "@/features/inventory/stores/warehouseStore";
import { Warehouse } from "@/features/inventory/types/warehouse";

const { Title, Text } = Typography;
const { Option } = Select;

// Định nghĩa theo chỉ thị của Sếp
const warehouseTypes = {
  b2b: { text: "Bán Buôn", color: "blue" },
  retail: { text: "Bán Lẻ", color: "green" },
};
const statusMap = {
  active: { text: "Đang hoạt động", color: "green" },
  inactive: { text: "Ngừng hoạt động", color: "red" },
};

const WarehouseListPage: React.FC = () => {
  const {
    warehouses,
    loading,
    page,
    pageSize,
    totalCount,
    fetchWarehouses,
    setFilters,
    setPage,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
  } = useWarehouseStore();

  const { message: antMessage } = AntApp.useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [form] = Form.useForm();

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchWarehouses();
  }, [page, pageSize]);

  useEffect(() => {
    setFilters({ search_query: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const showAddModal = () => {
    setEditingWarehouse(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    form.setFieldsValue(warehouse);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingWarehouse(null);
    form.resetFields();
  };

  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();
      let success = false;

      if (editingWarehouse) {
        success = await updateWarehouse(editingWarehouse.id, values);
        if (success)
          antMessage.success(`Cập nhật kho ${values.name} thành công!`);
      } else {
        success = await addWarehouse(values);
        if (success)
          antMessage.success(`Thêm mới kho ${values.name} thành công!`);
      }

      if (success) {
        handleModalClose();
      } else {
        antMessage.error("Thao tác thất bại. Vui lòng thử lại.");
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const handleDelete = async (record: Warehouse) => {
    const success = await deleteWarehouse(record.id);
    if (success) {
      antMessage.success(`Đã xóa kho "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại. Vui lòng thử lại.");
    }
  };

  const columns: TableProps<Warehouse>["columns"] = [
    {
      title: "Mã Kho",
      dataIndex: "code",
      key: "code",
    },
    {
      title: "Tên Kho Hàng / Đơn vị",
      dataIndex: "name",
      key: "name",
      render: (text) => (
        <Text strong style={{ color: "#003a78" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Loại Kho",
      dataIndex: "type",
      key: "type",
      render: (type) => {
        const typeInfo = warehouseTypes[type as "b2b" | "retail"] || {
          text: "Khác",
          color: "default",
        };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
      filters: Object.keys(warehouseTypes).map((key) => ({
        text: warehouseTypes[key as "b2b" | "retail"].text,
        value: key,
      })),
      onFilter: (value: any, record) => record.type === value,
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Người quản lý",
      dataIndex: "manager",
      key: "manager",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      align: "center" as const,
      render: (status) => {
        const statusInfo = statusMap[status as "active" | "inactive"];
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
      filters: Object.keys(statusMap).map((key) => ({
        text: statusMap[key as "active" | "inactive"].text,
        value: key,
      })),
      onFilter: (value: any, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      align: "center" as const,
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Sửa thông tin kho">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa kho">
            <Popconfirm
              title={`Sếp có chắc chắn muốn xóa Kho "${record.name}"?`}
              onConfirm={() => handleDelete(record)}
              okText="Đồng ý"
              cancelText="Hủy"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading} tip="Đang tải...">
      <Card styles={{ body: { padding: 12 } }}>
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 24 }}
        >
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              Quản lý Kho Hàng & Đơn vị
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<UploadOutlined />}
                onClick={() => antMessage.info("Chức năng đang phát triển")}
              >
                Nhập Excel
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => antMessage.info("Chức năng đang phát triển")}
              >
                Xuất Excel
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showAddModal}
              >
                Thêm Kho Mới
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo Tên kho, Mã kho, SĐT..."
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Col>
          <Col>
            <Select
              placeholder="Loại kho"
              style={{ width: 180 }}
              allowClear
              options={Object.keys(warehouseTypes).map((k) => ({
                label: warehouseTypes[k as "b2b" | "retail"].text,
                value: k,
              }))}
              onChange={(value) => setFilters({ type_filter: value })}
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              style={{ width: 180 }}
              allowClear
              options={Object.keys(statusMap).map((k) => ({
                label: statusMap[k as "active" | "inactive"].text,
                value: k,
              }))}
              onChange={(value) => setFilters({ status_filter: value })}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={warehouses}
          bordered
          rowKey="key"
          scroll={{ x: "max-content" }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: totalCount,
            onChange: setPage,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} kho`,
          }}
        />

        <Modal
          title={
            editingWarehouse
              ? `Chỉnh sửa Kho: ${editingWarehouse.name}`
              : "Thêm Kho / Đơn vị Mới"
          }
          open={isModalVisible}
          onCancel={handleModalClose}
          onOk={handleModalSave}
          okText="Lưu thay đổi"
          cancelText="Hủy"
          width={800}
          destroyOnHidden
          confirmLoading={loading}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ status: "active", type: "retail" }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Tên Kho / Đơn vị"
                  rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="Mã Kho"
                  extra="Để trống để tự động tạo (nếu cần)."
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="Loại Kho / Đơn vị"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={Object.keys(warehouseTypes).map((k) => ({
                      label: warehouseTypes[k as "b2b" | "retail"].text,
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="manager" label="Người quản lý/phụ trách">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="address" label="Địa chỉ">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
              {/* --- CỘT GPS THEO YÊU CẦU CỦA SẾP --- */}
              <Col span={8}>
                <Form.Item name="latitude" label="Vĩ độ (Latitude)">
                  <InputNumber style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="longitude" label="Kinh độ (Longitude)">
                  <InputNumber style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="phone" label="Số điện thoại liên hệ">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="status"
                  label="Trạng thái"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="active">Đang hoạt động</Option>
                    <Option value="inactive">Ngừng hoạt động</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Card>
    </Spin>
  );
};

export default WarehouseListPage;
