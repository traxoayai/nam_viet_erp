// src/pages/partners/SupplierListPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
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
  App as AntApp,
  Spin,
  Tooltip,
} from "antd";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate

import type { TableProps } from "antd";

import { useDebounce } from "@/shared/hooks/useDebounce";
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { Supplier } from "@/features/purchasing/types/supplier";

const { Title, Text } = Typography;

const statusMap = {
  active: { text: "Đang hợp tác", color: "green" },
  inactive: { text: "Ngừng hợp tác", color: "red" },
};

const SupplierListPage: React.FC = () => {
  const navigate = useNavigate(); // Khởi tạo hook
  const {
    suppliers,
    loading,
    page,
    pageSize,
    totalCount,
    fetchSuppliers,
    setFilters,
    setPage,
    deleteSupplier,
  } = useSupplierStore();

  const { message: antMessage } = AntApp.useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchSuppliers();
  }, [page, pageSize]);

  useEffect(() => {
    setFilters({ search_query: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const handleDelete = async (record: Supplier) => {
    const success = await deleteSupplier(record.id);
    if (success) {
      antMessage.success(`Đã xóa NCC "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại. Vui lòng thử lại.");
    }
  };

  const columns: TableProps<Supplier>["columns"] = [
    {
      title: "Mã NCC",
      dataIndex: "code",
      key: "code",
    },
    {
      title: "Tên Nhà Cung Cấp",
      dataIndex: "name",
      key: "name",
      render: (text) => (
        <Text strong style={{ color: "#003a78" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Người liên hệ",
      dataIndex: "contact_person",
      key: "contact_person",
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Công nợ",
      dataIndex: "debt",
      key: "debt",
      align: "right" as const,
      render: (debt) => (
        <Text strong style={{ color: debt > 0 ? "#cf1322" : "#3f8600" }}>
          {debt.toLocaleString("vi-VN")}đ
        </Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      align: "center" as const,
      render: (status) => {
        const statusInfo = statusMap[status as "active" | "inactive"] || {
          text: "Không rõ",
          color: "gray",
        };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: "Hành động",
      key: "action",
      align: "center" as const,
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem Chi tiết">
            {/* SỬA: Chuyển hướng đến trang Chi tiết */}
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/partners/detail/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Sửa thông tin">
            {/* SỬA: Chuyển hướng đến trang Chi tiết (chế độ sửa) */}
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/partners/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title={`Bạn có chắc chắn muốn xóa NCC "${record.name}"?`}
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
              Danh sách Nhà Cung Cấp
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
              {/* SỬA: Chuyển hướng đến trang Thêm mới */}
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/partners/new")}
              >
                Thêm Nhà Cung Cấp
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo Tên NCC, Mã NCC, SĐT..."
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              onChange={(value) =>
                setFilters({ status_filter: value as "active" | "inactive" })
              }
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={suppliers}
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
              `${range[0]}-${range[1]} của ${total} NCC`,
          }}
        />
        {/* XÓA: Toàn bộ <Modal> đã bị xóa bỏ */}
      </Card>
    </Spin>
  );
};

export default SupplierListPage;
