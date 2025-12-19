// src/pages/inventory/ProductListPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
  TagOutlined,
  PrinterOutlined,
  DeleteOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  Row,
  Col,
  Space,
  Image,
  Tag,
  Tooltip,
  Select,
  App as AntApp,
  Alert,
  Dropdown,
  Upload,
  Spin,
} from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

import type { TableProps, UploadProps } from "antd";

import { useDebounce } from "@/shared/hooks/useDebounce";
import * as productService from "@/features/inventory/api/productService";
import { useProductStore } from "@/features/inventory/stores/productStore";
import { Product } from "@/features/inventory/types/product";

const { Title, Text } = Typography;

const ProductListPage = () => {
  const navigate = useNavigate();
  const { message: antMessage, modal: antModal } = AntApp.useApp();

  const {
    // Lấy danh sách kho dynamic từ store
    warehouses: availableWarehouses,
    products,
    loading,
    page,
    pageSize,
    totalCount,
    fetchProducts,
    fetchCommonData,
    setFilters,
    setPage,
    updateStatus,
    deleteProducts,
    exportToExcel,
  } = useProductStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500); // Tải data chung (Kho, NCC - đã đổi tên)

  useEffect(() => {
    fetchCommonData();
  }, []); // <--- Rỗng: Chỉ chạy 1 lần khi vào trang

  useEffect(() => {
    fetchProducts();
  }, [page, pageSize]); // Xử lý tìm kiếm

  useEffect(() => {
    setFilters({ search_query: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const onSelectChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  const handleToggleStatus = (record: Product) => {
    const newStatus = record.status === "active" ? "inactive" : "active";
    const actionText =
      newStatus === "active" ? "Kinh doanh" : "Ngừng kinh doanh";

    antModal.confirm({
      title: `Xác nhận ${actionText}`,
      content: `Bạn có chắc muốn ${actionText.toLowerCase()} sản phẩm "${record.name}"?`,
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        await updateStatus([record.id], newStatus);
        antMessage.success(`Đã ${actionText.toLowerCase()} sản phẩm.`);
        setSelectedRowKeys([]);
      },
    });
  };

  const handleBulkUpdateStatus = (status: "active" | "inactive") => {
    const actionText = status === "active" ? "Kinh doanh" : "Ngừng kinh doanh";
    antModal.confirm({
      title: `Xác nhận ${actionText} hàng loạt`,
      content: `Bạn có chắc muốn ${actionText.toLowerCase()} ${selectedRowKeys.length} sản phẩm đã chọn?`,
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        await updateStatus(selectedRowKeys, status);
        antMessage.success(
          `Đã ${actionText.toLowerCase()} ${selectedRowKeys.length} sản phẩm.`
        );
        setSelectedRowKeys([]);
      },
    });
  };

  const handleBulkDelete = () => {
    antModal.confirm({
      title: `Xác nhận XÓA SẢN PHẨM`,
      content: `HÀNH ĐỘNG NÀY KHÔNG THỂ PHỤC HỒI. Bạn có chắc muốn XÓA VĨNH VIỄN ${selectedRowKeys.length} sản phẩm đã chọn?`,
      okText: "Xóa vĩnh viễn",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        await deleteProducts(selectedRowKeys);
        antMessage.success(`Đã xóa ${selectedRowKeys.length} sản phẩm.`);
        setSelectedRowKeys([]);
      },
    });
  };

  const handleExportExcel = async () => {
    antMessage.loading({
      content: "Đang chuẩn bị dữ liệu xuất...",
      key: "export",
    });
    try {
      const dataToExport = await exportToExcel();

      if (dataToExport.length === 0) {
        antMessage.info({
          content: "Không có dữ liệu nào để xuất.",
          key: "export",
        });
        return;
      } // Tạo Bảng tính

      const ws = XLSX.utils.json_to_sheet(dataToExport); // Tạo Sổ làm việc
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachSanPham"); // Xuất file
      XLSX.writeFile(
        wb,
        `DS_SanPham_NamViet_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      antMessage.success({
        content: `Đã xuất ${dataToExport.length} sản phẩm.`,
        key: "export",
      });
    } catch (error: any) {
      antMessage.error({
        content: `Xuất file thất bại: ${error.message}`,
        key: "export",
      });
    }
  };

  const uploadProps: UploadProps = {
    name: "file",
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setIsImporting(true);
      antMessage.loading({
        content: "Đang xử lý file Excel...",
        key: "import",
      });
      try {
        await productService.importProducts(file as File);

        if (onSuccess) onSuccess("ok");
        antMessage.success({
          content: "Import thành công! Đang tải lại danh sách.",
          key: "import",
        });
        fetchProducts(); // Tải lại danh sách sau khi import
      } catch (error: any) {
        if (onError) onError(error);
        antMessage.error({
          content: `Import thất bại: ${error.message}`,
          key: "import",
        });
      } finally {
        setIsImporting(false);
      }
    },
  }; // --- TẠO CỘT TỒN KHO ĐỘNG ---

  const inventoryColumns = useMemo(
    () =>
      availableWarehouses.map((wh) => ({
        title: `Tồn ${wh.name} (${wh.type === "b2b" ? "Thùng" : "Hộp"})`, // SỬA LỖI: Cần dùng key của kho để truy vấn cột động
        dataIndex: `inventory_${wh.key}`,
        key: `inventory_${wh.key}`,
        align: "center" as const,
        width: 120,
        render: (stock: number) => (
          <Text
            style={{ fontWeight: 500, color: stock > 0 ? "#333" : "#bfbfbf" }}
          >
            {stock}         
          </Text>
        ),
      })),
    [availableWarehouses]
  ); // Cấu hình cột (ĐÃ CẬP NHẬT HÀNH ĐỘNG)

  const columns: TableProps<Product>["columns"] = [
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
          <br />         <Text type="secondary">SKU: {record.sku}</Text>
          <br />         
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.category_name} | {record.manufacturer_name}       
          </Text>
        </div>
      ),
    }, // THAY THẾ: Sử dụng mảng cột tồn kho động đã tính toán
    ...inventoryColumns,
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center" as const,
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
              onClick={() => navigate(`/inventory/edit/${record.id}`)}
            />
          </Tooltip>

          <Tooltip
            title={
              record.status === "active" ? "Ngừng kinh doanh" : "Cho kinh doanh"
            }
          >
            <Button
              type="text"
              danger={record.status === "active"}
              icon={
                record.status === "active" ? (
                  <StopOutlined />
                ) : (
                  <SafetyOutlined />
                )
              }
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // SỬA LỖI: Chuyển sang cú pháp 'items' cho AntD v5
  const bulkActionMenu = [
    {
      key: "set_active",
      icon: <CheckCircleOutlined />,
      label: "Chuyển sang 'Đang kinh doanh'",
      onClick: () => handleBulkUpdateStatus("active"),
    },
    {
      key: "set_inactive",
      icon: <StopOutlined />,
      label: "Chuyển sang 'Ngừng kinh doanh'",
      danger: true,
      onClick: () => handleBulkUpdateStatus("inactive"),
    },
  ];

  return (
    <Spin spinning={loading} tip="Đang tải dữ liệu...">
      <Card styles={{ body: { padding: 12 } }}>
        {/* Phần 1: Header */}       
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 24 }}
        >
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              Danh sách Sản phẩm            
            </Title>
          </Col>

          <Col>
            <Space>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} loading={isImporting}>
                  Nhập Excel                
                </Button>
              </Upload>

              <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                Xuất Excel              
              </Button>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/inventory/new")}
              >
                Thêm sản phẩm              
              </Button>
            </Space>
          </Col>
        </Row>
        {/* Phần 2: Bộ lọc (Đã sửa) */}       
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
            <Input
              placeholder="Phân loại"
              style={{ width: 150 }}
              onChange={(e) => setFilters({ category_filter: e.target.value })}
            />
          </Col>

          <Col>
            <Input
              placeholder="Nhà sản xuất"
              style={{ width: 180 }}
              onChange={(e) =>
                setFilters({ manufacturer_filter: e.target.value })
              }
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
        {/* Thanh Hành động Hàng loạt (Đã kết nối) */}       
        {hasSelected ? (
          <Alert
            message={`${selectedRowKeys.length} sản phẩm được chọn`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Space>
                <Dropdown menu={{ items: bulkActionMenu }}>
                  <Button size="small">
                    Cập nhật Trạng thái <DownOutlined />                 
                  </Button>
                </Dropdown>
                <Button
                  size="small"
                  icon={<TagOutlined />}
                  onClick={() =>
                    antMessage.info("Chức năng Gắn nhãn đang được phát triển")
                  }
                >
                  Gắn nhãn                
                </Button>
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() =>
                    antMessage.info("Chức năng In nhãn đang được phát triển")
                  }
                >
                  In nhãn mã vạch                
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBulkDelete}
                >
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
            onChange: setPage,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} sản phẩm`,
          }}
        />
        {/* Modal đã bị xóa (theo chỉ thị) */}     
      </Card>
    </Spin>
  );
};

export default ProductListPage;
