// src/pages/sales/B2BOrderListPage.tsx
import {
  DollarCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
  FileExcelOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CarOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { Button, message, Tooltip, Modal, Select, Upload, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";

import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { parseBankStatement } from "@/shared/utils/bankStatementParser";

// --- MODULE HÓA ĐƠN & TÀI CHÍNH ---
import { InvoiceRequestModal } from "@/shared/ui/sales/InvoiceRequestModal";
import { generateInvoiceExcel } from "@/shared/utils/invoiceExcelGenerator";
import { salesService } from "@/features/sales/api/salesService";
import { supabase } from "@/shared/lib/supabaseClient";

const { Text } = Typography;

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
    supabase.from('fund_accounts').select('id, name').eq('status', 'active')
      .then(({ data }) => {
        setFundAccounts(data || []);
        if (data && data.length > 0) setSelectedFundId(data[0].id);
      });
  }, []);

  // --- 3. HANDLERS (LOGIC) ---

  // A. Xử lý Upload Sao kê/Đối soát
  const handleUploadStatement = async (file: File) => {
    try {
        message.loading({ content: "Đang đọc sao kê...", key: "upload" });
        const transactions = await parseBankStatement(file);

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

        const ordersList = tableProps.dataSource || [];
        // Chỉ tìm những đơn chưa thanh toán (unpaid)
        const matchedIds = ordersList
            .filter((o: any) => uniqueCodes.includes(o.code) && o.payment_status !== 'paid')
            .map((o: any) => o.id);

        if (matchedIds.length > 0) {
            setSelectedRowKeys(matchedIds);
            message.success({ content: `Đã tìm thấy ${matchedIds.length} đơn hàng khớp!`, key: "upload" });
            setIsPaymentModalOpen(true);
        } else {
            message.info({ content: "Mã đơn trong file không khớp đơn nào đang chờ thanh toán (trên trang này).", key: "upload" });
        }
    } catch (err: any) {
        message.error({ content: err.message, key: "upload" });
    }
    return false;
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
          refresh();
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
          const ordersData = await salesService.getOrdersForInvoiceExport(selectedRowKeys as string[]);
          generateInvoiceExcel(ordersData);
          message.success(`Đã xuất file cho ${ordersData.length} đơn hàng.`);
          setSelectedRowKeys([]);
      } catch (err: any) {
          message.error("Xuất file thất bại: " + err.message);
      } finally {
          setExportInvoiceLoading(false);
      }
  };

  // --- 4. CẤU HÌNH CỘT (COLUMNS DEFINITION) ---
  const columns = useMemo(() => [
    // 2. Ngày giờ tạo đơn
    {
        title: "Ngày tạo",
        dataIndex: "created_at",
        width: 140,
        render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
    },
    // 3. Mã đơn hàng
    {
        title: "Mã đơn",
        dataIndex: "code",
        width: 150,
        render: (code: string) => <Text strong copyable>{code}</Text>,
    },
    // 4. Tên khách hàng
    {
        title: "Khách hàng",
        dataIndex: "customer_name",
        width: 200,
        render: (name: string, record: any) => (
            <div>
                <Text strong>{name}</Text>
                <div style={{ fontSize: 11, color: '#666' }}>{record.customer_phone}</div>
            </div>
        ),
    },
    // 5. Tổng tiền
    {
        title: "Tổng tiền",
        dataIndex: "final_amount",
        align: "right" as const,
        width: 150,
        render: (val: number) => (
            <Text strong style={{ color: '#1890ff' }}>
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)}
            </Text>
        ),
    },
    // 6. Trạng thái đơn hàng (Lifecycle)
    {
        title: "Trạng thái Đơn",
        dataIndex: "status",
        width: 140,
        render: (status: string) => {
            const map: any = {
                DRAFT: { color: 'default', text: 'Nháp' },
                QUOTE: { color: 'purple', text: 'Báo giá' },
                CONFIRMED: { color: 'blue', text: 'Đã xác nhận' },
                SHIPPING: { color: 'cyan', text: 'Đang giao' },
                COMPLETED: { color: 'green', text: 'Hoàn thành' },
                CANCELLED: { color: 'red', text: 'Đã hủy' },
            };
            const s = map[status] || { color: 'default', text: status };
            return <Tag color={s.color}>{s.text}</Tag>;
        }
    },
    // 7. Trạng thái vận chuyển (Realtime Logistics)
    {
        title: "Vận chuyển",
        key: "shipping_status",
        width: 160,
        render: (_: any, record: any) => {
            // Logic hiển thị vận chuyển dựa trên status và delivery_method
            if (record.delivery_method === 'self_shipping' || record.order_type === 'POS') {
                return <Tag icon={<ShopOutlined />}>Tại quầy</Tag>;
            }
            if (record.status === 'CONFIRMED') return <Tag color="orange" icon={<SyncOutlined spin />}>Chờ đóng gói</Tag>;
            if (record.status === 'SHIPPING') return <Tag color="geekblue" icon={<CarOutlined />}>Đang giao hàng</Tag>;
            if (record.status === 'DELIVERED' || record.status === 'COMPLETED') return <Tag color="green">Khách đã nhận</Tag>;
            if (record.status === 'CANCELLED') return <Text type="secondary">-</Text>;
            return <Text type="secondary">Chờ xử lý</Text>;
        }
    },
    // 8. Trạng thái thanh toán (Paid/Unpaid/Reconciled)
    {
        title: "Thanh toán",
        key: "payment_status",
        width: 150,
        render: (_: any, record: any) => {
            // Ưu tiên check paid_amount đủ chưa
            const isPaid = record.payment_status === 'paid' || (record.paid_amount >= record.final_amount && record.final_amount > 0);
            
            if (isPaid) {
                return <Tag color="success" icon={<CheckCircleOutlined />}>Đã thanh toán</Tag>;
            }
            
            // Nếu chưa trả, check xem có phải đang chờ đối soát CK không
            if (record.payment_method === 'bank_transfer' || record.payment_method === 'debt') {
                return <Tag color="red">Chưa thanh toán</Tag>;
            }
            
            return <Tag color="warning">Công nợ</Tag>;
        }
    },
    // 9. Hóa đơn VAT
    {
        title: "Hóa Đơn",
        key: "invoice_action",
        width: 100,
        align: "center" as const,
        render: (_: any, record: any) => {
           const isPending = record.invoice_status === 'pending';
           const isIssued = record.invoice_status === 'issued';
           
           if (isIssued) {
             return <Tooltip title="Đã xuất HĐ"><CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} /></Tooltip>;
           }

           return (
             <Tooltip title={isPending ? "Đang chờ xuất (Click sửa)" : "Yêu cầu Xuất VAT"}>
                <Button 
                   size="small" 
                   type={isPending ? "dashed" : "text"}
                   style={{ color: isPending ? '#faad14' : undefined, borderColor: isPending ? '#faad14' : undefined }}
                   icon={<CloudUploadOutlined />}
                   onClick={(e) => {
                       e.stopPropagation();
                       handleRequestInvoice(record);
                   }}
                >
                   {isPending ? "Chờ xuất" : ""}
                </Button>
             </Tooltip>
           );
        }
    }
  ], []);

  // --- 5. DATA PREP (STATS) ---
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
      title: "Đơn chờ thanh toán",
      value: stats?.count_pending_remittance || 0,
      color: "#ff4d4f",
      icon: <FileTextOutlined />,
    },
  ];

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
            options: [
                { label: 'Hoàn thành', value: 'COMPLETED' },
                { label: 'Đang giao', value: 'SHIPPING' },
                { label: 'Đã xác nhận', value: 'CONFIRMED' },
                { label: 'Đã hủy', value: 'CANCELLED' },
            ],
          },
        ]}
        actions={[
          {
            render: (
              <Upload 
                beforeUpload={handleUploadStatement} 
                showUploadList={false}
                accept=".xlsx,.xls,.csv,.pdf"
              >
                 <Button icon={<CloudUploadOutlined />}>Đọc Sao Kê</Button>
              </Upload>
            )
          },
          {
            label: "Xuất Excel Misa",
            icon: <FileExcelOutlined />,
            onClick: handleExportInvoiceExcel,
            type: "default",
            loading: exportInvoiceLoading,
          },
          {
            label: "Tạo đơn B2B",
            type: "primary",
            icon: <PlusOutlined />,
            onClick: () => navigate("/b2b/create-order"),
          },
        ]}
      />

      <SmartTable
        {...tableProps}
        columns={columns}
        emptyText="Chưa có đơn hàng nào"
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

      {/* MODAL INVOICE */}
      <InvoiceRequestModal 
          visible={isInvoiceModalOpen}
          onCancel={() => setIsInvoiceModalOpen(false)}
          onSave={handleSaveInvoiceRequest}
          loading={false}
          initialData={
            currentOrderForInvoice ? {
                name: currentOrderForInvoice.customer_name, 
            } : undefined
          }
      />

      {/* MODAL PAYMENT */}
      <Modal
          title={`Xác nhận thu tiền ${selectedRowKeys.length} đơn hàng`}
          open={isPaymentModalOpen}
          onOk={async () => {
              if (!selectedFundId) return message.error("Vui lòng chọn Quỹ nhận tiền!");
              try {
                  await salesService.confirmPayment(selectedRowKeys as (string|number)[], selectedFundId);
                  setIsPaymentModalOpen(false);
                  refresh();
                  setSelectedRowKeys([]);
                  message.success("Đã tạo phiếu thu thành công!");
              } catch(e: any) { message.error("Lỗi: " + e.message) }
          }}
          onCancel={() => setIsPaymentModalOpen(false)}
          okText="Xác nhận Thu tiền"
          cancelText="Hủy"
      >
          <div style={{ padding: '8px 0' }}>
            <p>Tổng số đơn hàng: <b>{selectedRowKeys.length}</b></p>
            <p>Hệ thống sẽ cập nhật trạng thái "Đã thanh toán" và tạo Phiếu Thu.</p>
            <div style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 500 }}>Chọn Quỹ nhận tiền:</label>
                <Select 
                    style={{ width: '100%', marginTop: 8 }}
                    value={selectedFundId}
                    onChange={setSelectedFundId}
                    options={fundAccounts.map(f => ({ label: f.name, value: f.id }))}
                />
            </div>
          </div>
      </Modal>

    </div>
  );
};

export default B2BOrderListPage;