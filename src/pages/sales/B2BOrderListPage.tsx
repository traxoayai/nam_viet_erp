// src/pages/sales/B2BOrderListPage.tsx
import {
  DollarCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
  FileExcelOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { Button, message, Tooltip } from "antd"; // Add Button, message
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react"; // Add hooks

import { B2BOrderColumns } from "./components/B2BOrderColumns";
import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { B2B_STATUS_LABEL } from "@/shared/utils/b2bConstants";

// --- [NEW] MODULE HÓA ĐƠN ---
import { InvoiceRequestModal } from "@/shared/ui/sales/InvoiceRequestModal";
import { generateInvoiceExcel } from "@/shared/utils/invoiceExcelGenerator";
import { salesService } from "@/features/sales/api/salesService";

const B2BOrderListPage = () => {
  const navigate = useNavigate();

  // --- 1. STATE & HOOKS ---
  const { tableProps, filterProps, stats, currentFilters, refresh } = useSalesOrders({ orderType: 'B2B' });

  // State Xuất Hóa Đơn
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [currentOrderForInvoice, setCurrentOrderForInvoice] = useState<any>(null);
  const [exportInvoiceLoading, setExportInvoiceLoading] = useState(false);
  
  // State Chọn Hàng Loạt
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // --- 2. HANDLERS ---
  
  // A. Mở Modal Yêu cầu VAT
  const handleRequestInvoice = (record: any) => {
      setCurrentOrderForInvoice(record);
      setIsInvoiceModalOpen(true);
  };

  // B. Lưu Yêu cầu VAT
  const handleSaveInvoiceRequest = async (values: any) => {
      if (!currentOrderForInvoice) return;
      try {
          await salesService.updateInvoiceRequest(currentOrderForInvoice.id, values);
          message.success("Đã cập nhật yêu cầu xuất hóa đơn!");
          setIsInvoiceModalOpen(false);
          refresh(); // Reload bảng để cập nhật icon
      } catch (err: any) {
          message.error("Lỗi: " + err.message);
      }
  };

  // C. Xuất Excel Misa
  const handleExportInvoiceExcel = async () => {
      if (selectedRowKeys.length === 0) {
          message.warning("Vui lòng chọn các đơn hàng cần xuất!");
          return;
      }
      setExportInvoiceLoading(true);
      try {
          // Lấy dữ liệu chi tiết
          const ordersData = await salesService.getOrdersForInvoiceExport(selectedRowKeys as string[]);
          // Gọi Utility tạo file
          generateInvoiceExcel(ordersData);
          message.success(`Đã xuất file cho ${ordersData.length} đơn hàng.`);
          setSelectedRowKeys([]); // Reset chọn
      } catch (err: any) {
          message.error("Xuất file thất bại: " + err.message);
      } finally {
          setExportInvoiceLoading(false);
      }
  };

  // --- 3. COLUMNS CONFIG ---
  const columns = useMemo(() => {
    // Clone cột cũ và thêm cột Action
    return [
      ...B2BOrderColumns,
      {
        title: "Hóa Đơn",
        key: "invoice_action",
        width: 100,
        align: "center" as const,
        render: (_: any, record: any) => {
           const isPending = record.invoice_status === 'pending';
           const isIssued = record.invoice_status === 'issued';
           
           if (isIssued) {
             return <Tooltip title="Đã xuất HĐ"><CheckCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>;
           }

           return (
             <Tooltip title={isPending ? "Đang chờ xuất (Click để sửa)" : "Yêu cầu Xuất VAT"}>
                <Button 
                   size="small" 
                   type={isPending ? "dashed" : "text"}
                   style={{ color: isPending ? '#faad14' : undefined }}
                   icon={<CloudUploadOutlined />}
                   onClick={(e) => {
                       e.stopPropagation(); // Tránh click row
                       handleRequestInvoice(record);
                   }}
                />
             </Tooltip>
           );
        }
      }
    ];
  }, []); // Cột Action phụ thuộc vào logic render

  // --- 4. DATA PREP ---
  const statItems = [
    {
      title: "Doanh số (Đã chốt)",
      value: `${(stats?.total_sales || 0).toLocaleString()} ₫`,
      color: "#1890ff",
      icon: <DollarCircleOutlined />,
    },
    {
      title: "Tiền mặt chờ nộp",
      value: `${(stats?.total_cash_pending || 0).toLocaleString()} ₫`,
      color: "#faad14",
      icon: <WarningOutlined />,
    },
     {
      title: "Số đơn chờ nộp",
      value: stats?.count_pending_remittance || 0,
      color: "#ff4d4f",
      icon: <FileTextOutlined />,
    },
  ];

  const statusOptions = Object.entries(B2B_STATUS_LABEL).map(
    ([val, label]) => ({ label, value: val })
  );

  return (
    <div style={{ padding: 8, background: "#e1e1dfff", minHeight: "100vh" }}>
      <StatHeader items={statItems} loading={tableProps.loading} />

      <FilterAction
        {...filterProps}
        searchPlaceholder="Tìm mã đơn, tên khách..."
        filterValues={currentFilters}
        filters={[
          {
            key: "status",
            placeholder: "Lọc trạng thái",
            options: statusOptions,
          },
        ]}
        actions={[
          // [NEW] Nút Export Misa
          {
            label: "Xuất File Kế Toán (Misa)",
            icon: <FileExcelOutlined />,
            onClick: handleExportInvoiceExcel,
            type: "default", // Style nhẹ nhàng
            loading: exportInvoiceLoading, // [FIX] Sử dụng biến state
          },
          {
            label: "Tạo đơn mới",
            type: "primary",
            icon: <PlusOutlined />,
            onClick: () => navigate("/b2b/create-order"),
          },
        ]}
      />

      <SmartTable
        {...tableProps}
        columns={columns} // Use extended columns
        emptyText="Chưa có đơn hàng nào"
        // [NEW] Row Selection
        rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/b2b/orders/${record.id}`),
          style: { cursor: "pointer" },
        })}
      />

      {/* [NEW] MODAL RENDER */}
      <InvoiceRequestModal 
          visible={isInvoiceModalOpen}
          onCancel={() => setIsInvoiceModalOpen(false)}
          onSave={handleSaveInvoiceRequest}
          loading={false}
          initialData={
            currentOrderForInvoice ? {
                // Map dữ liệu có sẵn từ đơn hàng (nếu có snapshot customer)
                // Giả định record có customer_name, có thể mở rộng sau
                name: currentOrderForInvoice.customer_name, 
            } : undefined
          }
      />
    </div>
  );
};

export default B2BOrderListPage;
