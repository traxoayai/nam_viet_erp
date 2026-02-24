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
import * as XLSX from "xlsx"; // Import XLSX

import { ExcelImportModal } from "./components/ExcelImportModal"; // Import Modal

import type { TableProps } from "antd";

import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]
import { supplierService } from "@/features/purchasing/api/supplierService"; // [NEW] Import Service
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { Supplier } from "@/features/purchasing/types/supplier";
import { Access } from "@/shared/components/auth/Access"; // [NEW]
import { PermissionGuard } from "@/shared/components/auth/PermissionGuard"; // [NEW]
import { useDebounce } from "@/shared/hooks/useDebounce";

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

  const [importModalOpen, setImportModalOpen] = useState(false);

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

  // 1. Hàm nhận dữ liệu từ Modal -> Gọi API
  const handleImportSubmit = async (data: any[]) => {
    try {
      // Gọi Service
      await supplierService.importSuppliersBulk(data);
      antMessage.success(`Đã nhập thành công ${data.length} nhà cung cấp!`);
      setImportModalOpen(false);
      fetchSuppliers(); // Refresh lại danh sách
    } catch (error: any) {
      antMessage.error("Lỗi nhập dữ liệu: " + error.message);
      throw error; // Throw to let Modal know it failed
    }
  };

  // 2. Hàm Xuất Excel (Client-side cho nhanh)
  const handleExport = () => {
    if (suppliers.length === 0)
      return antMessage.warning("Không có dữ liệu để xuất");

    // Format dữ liệu cho đẹp
    const exportData = suppliers.map((s) => ({
      "Mã NCC": s.code || `SUP-${s.id}`,
      "Tên NCC": s.name,
      "Người liên hệ": s.contact_person,
      SĐT: s.phone,
      "Công nợ": s.debt,
      "Trạng thái": s.status === "active" ? "Đang hợp tác" : "Ngừng hợp tác",
    }));

    // Tạo file
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NhaCungCap");

    // Tải xuống
    XLSX.writeFile(
      wb,
      `DanhSachNCC_${new Date().toISOString().split("T")[0]}.xlsx`
    );
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

          <Access permission={PERMISSIONS.PARTNER.SUPPLIER.EDIT}>
            <Tooltip title="Sửa thông tin">
              {/* SỬA: Chuyển hướng đến trang Chi tiết (chế độ sửa) */}
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/partners/edit/${record.id}`)}
              />
            </Tooltip>
          </Access>

          <Access permission={PERMISSIONS.PARTNER.SUPPLIER.DELETE}>
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
          </Access>
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
                onClick={() => setImportModalOpen(true)}
              >
                Nhập Excel
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                Xuất Excel
              </Button>
              {/* SỬA: Chuyển hướng đến trang Thêm mới */}
              {/* SỬA: Chuyển hướng đến trang Thêm mới */}
              <Access permission={PERMISSIONS.PARTNER.SUPPLIER.CREATE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate("/partners/new")}
                >
                  Thêm Nhà Cung Cấp
                </Button>
              </Access>
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
        {/* Modal Import */}
        <ExcelImportModal
          open={importModalOpen}
          onCancel={() => setImportModalOpen(false)}
          onImport={handleImportSubmit}
          templateType="supplier"
        />
      </Card>
    </Spin>
  );
};

const ProtectedSupplierListPage = () => (
  <PermissionGuard permission={PERMISSIONS.PARTNER.SUPPLIER.VIEW}>
    <SupplierListPage />
  </PermissionGuard>
);

export default ProtectedSupplierListPage;
