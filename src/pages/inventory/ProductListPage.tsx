// src/pages/inventory/transfer/ProductListPage.tsx
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
  FilePdfOutlined, // [NEW] Icon PDF
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
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

import type { TableProps, UploadProps } from "antd";

import { useDebounce } from "@/shared/hooks/useDebounce";
// import * as productService from "@/features/product/api/productService";
import * as productExcelManager from "@/features/product/utils/productExcelManager"; // Import Manager
import { useProductStore } from "@/features/product/stores/productStore";
import { Product } from "@/features/product/types/product.types";
import { ProductAiScannerModal } from "@/features/product/components/ProductAiScannerModal"; // [NEW]
import { aiService } from "@/features/product/api/aiService"; // [NEW]
import { updateProduct } from "@/features/product/api/productService"; // [NEW] Hàm update cũ
import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]
import { Access } from "@/shared/components/auth/Access"; // [NEW]

const { Title, Text } = Typography;

const ProductListPage = () => {
  const navigate = useNavigate();
  const { message: antMessage, modal: antModal } = AntApp.useApp();

  const {
    // Lấy danh sách kho dynamic từ store
    // warehouses: availableWarehouses, // Unused
    products,
    loading,
    page,
    pageSize,
    totalCount,
    fetchProducts,
    fetchCommonData,
    setFilters,
    setPage,
    // updateStatus, // Unused
    checkAndUpdateStatus, // [NEW]
    checkAndDeleteProducts,
    exportToExcel,
  } = useProductStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  
  // [NEW] AI Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [targetProductForAi, setTargetProductForAi] = useState<Product | null>(null);

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

  // Helper: Show Dependency Warning
  const showDependencyWarning = (dependencies: any[], action: string) => {
    antModal.warning({
      title: `Không thể ${action} sản phẩm đang sử dụng`,
      width: 600,
      content: (
          <div>
              <p>Các sản phẩm sau đang được sử dụng trong Gói khám hoặc Hóa đơn:</p>
              <ul>
                  {dependencies.map((dep, idx) => (
                      <li key={idx}>
                          <b>{dep.product_name}</b> - {dep.reason} (Ref: {dep.ref_source})
                      </li>
                  ))}
              </ul>
              <p>Vui lòng gỡ bỏ liên kết trước khi thực hiện.</p>
          </div>
      )
    });
  };

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
        try {
          const result = await checkAndUpdateStatus([record.id], newStatus);
          if (result.success) {
            antMessage.success(`Đã ${actionText.toLowerCase()} sản phẩm.`);
            setSelectedRowKeys([]);
          } else {
             showDependencyWarning(result.dependencies || [], actionText.toLowerCase());
          }
        } catch (err: any) {
            antMessage.error("Lỗi cập nhật: " + err.message);
        }
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
        try {
           const result = await checkAndUpdateStatus(selectedRowKeys, status);
           if (result.success) {
             antMessage.success(
               `Đã ${actionText.toLowerCase()} ${selectedRowKeys.length} sản phẩm.`
             );
             setSelectedRowKeys([]);
           } else {
              showDependencyWarning(result.dependencies || [], actionText.toLowerCase());
           }
        } catch (err: any) {
             antMessage.error("Lỗi cập nhật: " + err.message);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    antModal.confirm({
      title: `Xác nhận XÓA SẢN PHẨM`,
      content: `HÀNH ĐỘNG NÀY KHÔNG THỂ PHỤC HỒI. Bạn có chắc muốn XÓA VĨNH VIỄN ${selectedRowKeys.length} sản phẩm đã chọn?`,
      okText: "Kiểm tra & Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
            const result = await checkAndDeleteProducts(selectedRowKeys);
            
            if (result.success) {
                antMessage.success(`Đã xóa ${selectedRowKeys.length} sản phẩm thành công.`);
                setSelectedRowKeys([]);
            } else {
                // Show Warning Dependencies
                showDependencyWarning(result.dependencies || [], "xóa");
            }
        } catch (err: any) {
            antMessage.error("Lỗi xóa sản phẩm: " + err.message);
        }
      },
    });
  };

  // Nút Xuất Excel: Cho user chọn Template hoặc Xuất Dữ liệu
  const handleDownloadTemplate = () => {
       productExcelManager.downloadTemplate();
       antMessage.success("Đã tải xuống file mẫu nhập liệu.");
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
        content: "Đang xử lý file Excel V2...",
        key: "import",
      });
      try {
        // [UPDATE] Sử dụng Manager V2 thay vì Service cũ
        const count = await productExcelManager.importProductsFromExcel(file as File);

        if (onSuccess) onSuccess("ok");
        antMessage.success({
          content: `Import thành công ${count} sản phẩm! Đang tải lại danh sách.`,
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


  // inventoryColumns unused if we are using static columns for now, or keep if we want to mix.
  // The user requirement said: "Update Table Columns... Note: The RPC returns total_stock (Sum). If you want to show per-warehouse stock... show total_stock."
  // So I removed `...inventoryColumns` from usage. I should remove the definition too.
  
  // REMOVED inventoryColumns usage to follow "Standardize" request.
  

  // Cấu hình cột (ĐÃ CẬP NHẬT HÀNH ĐỘNG)
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
          <br />
          <Text type="secondary">SKU: {record.sku}</Text>
          <br />
          <Tag color="cyan" style={{ fontSize: 10, marginTop: 4 }}>
             {record.active_ingredient || record.category_name} 
          </Tag>
        </div>
      ),
    },
    {
      title: "Đơn vị Cơ bản",
      dataIndex: "base_unit",
      key: "base_unit",
      width: 100,
      align: "center",
      // Nếu RPC trả 'base_unit' thì dùng, nếu ko map từ legacy data
      render: (text: string, record: any) => record.retail_unit || text || "-",
    },
    {
      title: "Giá Vốn",
      dataIndex: "actual_cost",
      key: "actual_cost",
      width: 120,
      align: "right",
      render: (val: number) => (
        <Access permission={PERMISSIONS.INVENTORY.VIEW_COST} fallback="***">
             {val ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val) : "-"}
        </Access>
      ),
    },
    {
      title: "Giá Bán Lẻ",
      dataIndex: "retail_price",
      key: "retail_price",
      width: 120,
      align: "right",
      render: (val: number, record: any) => 
        (val || record.estimatedRetailPrice) 
        ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || record.estimatedRetailPrice)
        : "-",
    },
    {
        title: "Tổng Kho",
        dataIndex: "total_stock",
        key: "total_stock",
        width: 100,
        align: "center",
        // Fallback vào logic cũ nếu cần, hoặc dùng field RPC
        render: (val: number, _record: any) => {
            if (val !== undefined) return <b>{val}</b>;
            // Tạm thời hiển thị sum nếu RPC chưa update
            // let sum = 0; if(record.inventory_b2b) sum+=record.inventory_b2b; ...
            return "-";
        }
    },
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
      width: 140, // Tăng width để đủ chỗ
      fixed: "right" as const,
      render: (_: any, record: Product) => (
        <Space>
           {/* [NEW] Nút AI Scanner */}
          <Tooltip title="Cập nhật thông tin bằng AI (PDF)">
            <Button 
              type="text" 
              icon={<FilePdfOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => {
                 setTargetProductForAi(record);
                 setIsScannerOpen(true);
              }}
            />
          </Tooltip>
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

  // [NEW] Xử lý khi AI Scan thành công
  const handleAiUpdateSuccess = async (aiData: any) => {
    if (!targetProductForAi) return;

    try {
        antMessage.loading({ content: "Đang cập nhật dữ liệu...", key: 'ai_update' });

        // Map dữ liệu AI sang format mà hàm updateProduct hiểu
        const formValues = aiService.mapAiDataToForm(aiData);

        // Gọi hàm update cũ (Lưu ý: inventoryPayload để rỗng vẫn OK)
        await updateProduct(targetProductForAi.id, formValues, []);

        antMessage.success({ content: "Cập nhật thành công!", key: 'ai_update' });
        fetchProducts(); // Reload bảng
        setIsScannerOpen(false); // Đóng modal
    } catch (err: any) {
        antMessage.error({ content: "Lỗi cập nhật: " + err.message, key: 'ai_update' });
    }
  };

  return (
    <>
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
                <Dropdown menu={{
                    items: [
                        { key: 'import_file', label: 'Tải lên file Excel', icon: <UploadOutlined /> },
                        { key: 'download_template', label: 'Tải file mẫu', icon: <DownloadOutlined />, onClick: handleDownloadTemplate }
                    ]
                }}>
                    <Button icon={<UploadOutlined />} loading={isImporting}>
                         Nhập Excel <DownOutlined />
                    </Button>
                </Dropdown>
              </Upload>

              <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                Xuất DS
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
          rowKey="id" // FIX: Use ID instead of key
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

    {/* [NEW] AI Scanner Modal */}
    <ProductAiScannerModal 
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode="update_existing"
        onSuccess={handleAiUpdateSuccess}
    />
  );
    </>
  );
};

export default ProductListPage;
