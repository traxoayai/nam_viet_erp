import {
  DollarCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
  FileExcelOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { Button, message, Tooltip, Modal, Select, Upload } from "antd"; // Add Modal, Select, Upload
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react"; // Add useEffect

import { B2BOrderColumns } from "./components/B2BOrderColumns";
import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { B2B_STATUS_LABEL } from "@/shared/utils/b2bConstants";
import { parseBankStatement } from "@/shared/utils/bankStatementParser"; // Add this

// --- [NEW] MODULE HÓA ĐƠN ---
import { InvoiceRequestModal } from "@/shared/ui/sales/InvoiceRequestModal";
import { generateInvoiceExcel } from "@/shared/utils/invoiceExcelGenerator";
import { salesService } from "@/features/sales/api/salesService";
import { supabase } from "@/shared/lib/supabaseClient"; // Add this

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

  // State Xác nhận Thu tiền (B2B Payment)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [fundAccounts, setFundAccounts] = useState<any[]>([]); 
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);

  // --- 2. EFFECT: LOAD QUỸ ---
  useEffect(() => {
    // Load danh sách quỹ active khi mount
    supabase.from('fund_accounts').select('id, name').eq('status', 'active')
      .then(({ data }) => {
        setFundAccounts(data || []);
        if (data && data.length > 0) setSelectedFundId(data[0].id);
      });
  }, []);

  // --- 3. HANDLERS ---

  // A. Xử lý Upload Sao kê/Đối soát
  const handleUploadStatement = async (file: File) => {
    try {
        message.loading({ content: "Đang đọc sao kê...", key: "upload" });
        const transactions = await parseBankStatement(file); // Returns BankTransaction[]

        // Extract codes from transactions
        const codes: string[] = [];
        transactions.forEach(t => {
            const matches = t.description.match(/(SO|DH)[- ]?\d+/gi);
            if (matches) {
                matches.forEach(m => codes.push(m.replace(' ', '-').toUpperCase()));
            }
        });
        const uniqueCodes = [...new Set(codes)];


        if (uniqueCodes.length === 0) {
            message.warning({ content: "Không tìm thấy mã SO- nào trong file.", key: "upload" });
            return false;
        }

        const ordersList = tableProps.dataSource || []; // Chỉ đối soát trên trang hiện tại
        // Tìm ID đơn hàng khớp mã
        const matchedIds = ordersList
            .filter((o: any) => uniqueCodes.includes(o.code) && o.payment_status !== 'paid')
            .map((o: any) => o.id);

        if (matchedIds.length > 0) {
            setSelectedRowKeys(matchedIds); // Tự động tick
            message.success({ content: `Đã tìm thấy ${matchedIds.length} đơn hàng khớp!`, key: "upload" });
            setIsPaymentModalOpen(true); // Mở modal xác nhận ngay
        } else {
            message.info({ content: "Mã đơn trong file không khớp đơn nào đang chờ thanh toán (trên trang này).", key: "upload" });
        }
    } catch (err: any) {
        message.error({ content: err.message, key: "upload" });
    }
    return false; // Prevent default upload behavior
  };
  
  // B. Mở Modal Yêu cầu VAT
  const handleRequestInvoice = (record: any) => {
      setCurrentOrderForInvoice(record);
      setIsInvoiceModalOpen(true);
  };

  // C. Lưu Yêu cầu VAT
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

  // D. Xuất Excel Misa
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

  // --- 4. COLUMNS CONFIG ---
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

  // --- 5. DATA PREP ---
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
          // [NEW] Nút Upload Đối soát
          {
            render: (
              <Upload 
                beforeUpload={handleUploadStatement} 
                showUploadList={false}
                accept=".xlsx,.xls,.csv,.pdf"
              >
                 <Button icon={<CloudUploadOutlined />}>Đọc Sao Kê (PDF/Excel)</Button>
              </Upload>
            )
          },
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

      {/* [NEW] MODAL INVOICE RENDER */}
      <InvoiceRequestModal 
          visible={isInvoiceModalOpen}
          onCancel={() => setIsInvoiceModalOpen(false)}
          onSave={handleSaveInvoiceRequest}
          loading={false}
          initialData={
            currentOrderForInvoice ? {
                // Map dữ liệu có sẵn từ đơn hàng (nếu có snapshot customer)
                name: currentOrderForInvoice.customer_name, 
            } : undefined
          }
      />

      {/* [NEW] MODAL PAYMENT CONFIRMATION */}
      <Modal
          title={`Xác nhận thu tiền ${selectedRowKeys.length} đơn hàng`}
          open={isPaymentModalOpen}
          onOk={async () => {
              if (!selectedFundId) {
                message.error("Vui lòng chọn Quỹ nhận tiền!");
                return;
              }
              try {
                  // Chỉ lấy các ID hợp lệ (string/number)
                  await salesService.confirmPayment(selectedRowKeys as (string|number)[], selectedFundId);
                  setIsPaymentModalOpen(false);
                  refresh(); // Reload list
                  setSelectedRowKeys([]);
                  message.success("Đã tạo phiếu thu thành công!");
              } catch(e: any) { message.error("Lỗi: " + e.message) }
          }}
          onCancel={() => setIsPaymentModalOpen(false)}
          okText="Xác nhận Thu tiền"
          cancelText="Hủy"
      >
          <div style={{ padding: '8px 0' }}>
            <p>Tổng số đơn hàng được chọn: <b>{selectedRowKeys.length}</b></p>
            <p>Hệ thống sẽ tự động tạo Phiếu Thu và trừ công nợ khách hàng.</p>
            
            <div style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 500 }}>Chọn Tài khoản/Quỹ nhận tiền:</label>
                <Select 
                    style={{ width: '100%', marginTop: 8 }}
                    value={selectedFundId}
                    onChange={setSelectedFundId}
                    options={fundAccounts.map(f => ({ label: f.name, value: f.id }))}
                    placeholder="Chọn quỹ..."
                />
            </div>
          </div>
      </Modal>

    </div>
  );
};

export default B2BOrderListPage;
