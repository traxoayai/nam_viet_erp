// src/pages/inventory/ProductListPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  TagOutlined,
  PrinterOutlined,
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
  Image,
  Tag,
  Tooltip,
  Modal,
  App as AntApp,
  Menu,
  Alert,
  Dropdown,
} from "antd";
import React, { useEffect, useState } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import { useProductStore } from "@/stores/productStore"; // Import "Bộ não"
import { Product } from "@/types/product";

const { Title, Text } = Typography;

// Định nghĩa kho tĩnh (theo canvas)
const warehouses = [
  { key: "inventory_b2b", name: "Tồn Nam Việt B2B", unit: "Hộp" },
  { key: "inventory_pkdh", name: "Tồn P.khám Định Hiền", unit: "Hộp" },
  { key: "inventory_ntdh1", name: "Tồn N.thuốc ĐH 1", unit: "Hộp" },
  { key: "inventory_ntdh2", name: "Tồn N.thuốc ĐH 2", unit: "Hộp" },
  { key: "inventory_potec", name: "Tồn Tiêm chủng Potec", unit: "Hộp" },
];

const ProductListPage = () => {
  // Lấy trạng thái và hành động từ "Bộ não" Zustand
  const {
    products,
    categories,
    manufacturers,
    loading,
    filters,
    page,
    pageSize,
    totalCount,
    fetchProducts,
    fetchFiltersData,
    setFilters,
    setPage,
  } = useProductStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { message } = AntApp.useApp();

  // Sử dụng "useDebounce" để tránh gọi API liên tục khi gõ
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Tải dữ liệu lọc (Categories, Manufacturers) một lần khi trang mở
  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  // Tải sản phẩm (gọi API) khi trang mở hoặc khi bộ lọc/trang thay đổi
  // (Logic này đã được chuyển vào trong store)
  useEffect(() => {
    fetchProducts();
  }, [page, pageSize]); // Chỉ gọi lại khi trang thay đổi (lọc đã xử lý trong setFilters)

  // Xử lý khi gõ tìm kiếm
  useEffect(() => {
    setFilters({ search_query: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const onSelectChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
  };

  const showAddModal = () => {
    setEditingProduct(null);
    setIsModalVisible(true);
  };

  const showEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingProduct(null);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  // Cấu hình cột (giống hệt canvas của Sếp)
  const columns = [
    {
      title: "Ảnh",
      dataIndex: "image_url",
      key: "image_url",
      width: 100,
      render: (url: string) => (
        <Image
          src={url || "https://placehold.co/80x80/eee/ccc?text=N/A"}
          alt="Ảnh SP"
          width={60}
          height={60}
          style={{ objectFit: "cover", borderRadius: "4px" }}
        />
      ),
    },
    {
      title: "Tên Sản Phẩm",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Product) => (
        <div>
          <Text strong style={{ color: "#003a78" }}>
            {text}
          </Text>
          <br />
          <Text type="secondary">SKU: {record.sku}</Text>
        </div>
      ),
    },
    ...warehouses.map((wh) => ({
      title: `${wh.name} (${wh.unit})`,
      dataIndex: wh.key,
      key: wh.key,
      align: "center",
      width: 120,
      render: (stock: number) => (
        <Text
          style={{ fontWeight: 500, color: stock > 0 ? "#333" : "#bfbfbf" }}
        >
          {stock}
        </Text>
      ),
    })),
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center",
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "red"}>
          {status === "active" ? "Đang kinh doanh" : "Ngừng kinh doanh"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: Product) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => message.error("Chức năng Xóa đang được mô phỏng")}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const bulkActionMenu = (
    <Menu onClick={(e) => message.info(`Đã áp dụng: ${e.key}`)}>
      <Menu.Item key="set_active" icon={<CheckCircleOutlined />}>
        Chuyển sang "Đang kinh doanh"
      </Menu.Item>
      <Menu.Item key="set_inactive" icon={<StopOutlined />} danger>
        Chuyển sang "Ngừng kinh doanh"
      </Menu.Item>
    </Menu>
  );

  return (
    <Card bodyStyle={{ padding: 12 }}>
      {/* Phần 1: Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Danh sách Sản phẩm
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<UploadOutlined />}>Nhập Excel</Button>
            <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              Thêm sản phẩm
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Phần 2: Bộ lọc */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo Tên, SKU, Hoạt chất, Barcode..."
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Col>
        <Col>
          <Select
            placeholder="Phân loại"
            style={{ width: 150 }}
            allowClear
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
            onChange={(value) => setFilters({ category_filter: value })}
          />
        </Col>
        <Col>
          <Select
            placeholder="Nhà sản xuất"
            style={{ width: 180 }}
            allowClear
            options={manufacturers.map((m) => ({ label: m.name, value: m.id }))}
            onChange={(value) => setFilters({ manufacturer_filter: value })}
          />
        </Col>
        <Col>
          <Select
            placeholder="Kho"
            style={{ width: 150 }}
            allowClear
            disabled // Sẽ làm chức năng này sau (lọc tồn kho theo kho)
          />
        </Col>
        <Col>
          <Select
            placeholder="Trạng thái"
            style={{ width: 150 }}
            allowClear
            options={[
              { label: "Đang kinh doanh", value: "active" },
              { label: "Ngừng kinh doanh", value: "inactive" },
            ]}
            onChange={(value) => setFilters({ status_filter: value })}
          />
        </Col>
      </Row>

      {/* Thanh Hành động Hàng loạt */}
      {hasSelected ? (
        <Alert
          message={`${selectedRowKeys.length} sản phẩm được chọn`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Space>
              <Dropdown overlay={bulkActionMenu}>
                <Button size="small">
                  Cập nhật Trạng thái <DownOutlined />
                </Button>
              </Dropdown>
              <Button size="small" icon={<TagOutlined />}>
                Gắn nhãn
              </Button>
              <Button size="small" icon={<PrinterOutlined />}>
                In nhãn mã vạch
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />}>
                Xóa {selectedRowKeys.length} sản phẩm
              </Button>
            </Space>
          }
        />
      ) : null}

      {/* Phần 3: Bảng dữ liệu */}
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={products}
        loading={loading}
        bordered
        rowKey="key"
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: totalCount,
          onChange: setPage, // AntD tự động truyền (page, pageSize)
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} của ${total} sản phẩm`,
        }}
      />

      {/* Modal Thêm/Sửa (Giữ nguyên như canvas) */}
      <Modal
        title={
          editingProduct
            ? `Sửa sản phẩm: ${editingProduct.name}`
            : "Thêm sản phẩm mới"
        }
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <Text>Nội dung form chi tiết sản phẩm...</Text>
        <div style={{ textAlign: "right", marginTop: 24 }}>
          <Space>
            <Button onClick={handleModalClose}>Hủy</Button>
            <Button
              type="primary"
              onClick={() => {
                message.success("Đã lưu!");
                handleModalClose();
              }}
            >
              Lưu thay đổi
            </Button>
          </Space>
        </div>
      </Modal>
    </Card>
  );
};

export default ProductListPage;
