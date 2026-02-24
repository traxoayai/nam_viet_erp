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
  UserOutlined,
  PrinterOutlined,
  DeleteOutlined, // [NEW]
} from "@ant-design/icons";
import {
  Button,
  message,
  Modal,
  Select,
  Upload,
  Tag,
  Typography,
  Avatar,
  Space,
  Input,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]
import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate";
import { VatActionButton } from "@/features/pos/components/VatActionButton";
import { b2bService } from "@/features/sales/api/b2bService";
import { salesService } from "@/features/sales/api/salesService";
import { useOrderPrint } from "@/features/sales/hooks/useOrderPrint"; // [NEW]
import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders";

// import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders"; // Duplicate removed
import { FinanceFormModal } from "@/pages/finance/components/FinanceFormModal"; // [NEW]
import { Access } from "@/shared/components/auth/Access"; // [NEW]
import { supabase } from "@/shared/lib/supabaseClient";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { parseBankStatement } from "@/shared/utils/bankStatementParser";

// --- MODULE HÓA ĐƠN & TÀI CHÍNH ---
import { generateInvoiceExcel } from "@/shared/utils/invoiceExcelGenerator";
import { usePickingListPrint } from "@/features/sales/hooks/usePickingListPrint";

const { Text } = Typography;

const B2BOrderListPage = () => {
  const navigate = useNavigate();

  // --- 1. STATE & HOOKS ---
  const { tableProps, filterProps, stats, currentFilters, refresh } =
    useSalesOrders({ orderType: "B2B" });
  const { printOrder } = useOrderPrint(); // [NEW]
  const { printData: pickingData } = usePickingListPrint(); // [NEW] Fetch & Print Picking

  // State Xuất Hóa Đơn
  const [exportInvoiceLoading, setExportInvoiceLoading] = useState(false);

  // State Chọn Hàng Loạt
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // State Xác nhận Thu tiền (B2B Payment Bulk) - Cũ
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [fundAccounts, setFundAccounts] = useState<any[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);

  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] =
    useState<any>(null);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<
    "cash" | "bank_transfer"
  >("cash"); // [NEW]

  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Users (Sales Staff)
  const [creators, setCreators] = useState<any[]>([]);

  // --- 2. EFFECT: LOAD QUỸ & USERS ---
  useEffect(() => {
    // Load Fund Accounts
    supabase
      .from("fund_accounts")
      .select("id, name")
      .eq("status", "active")
      .then(({ data }) => {
        setFundAccounts(data || []);
        if (data && data.length > 0) setSelectedFundId(data[0].id);
      });

    // Load Sales Staff (Creators)
    supabase
      .from("users")
      .select("id, full_name, email, work_state")
      .neq("work_state", "test")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        setCreators(data || []);
      });
  }, []);

  // --- 3. HANDLERS (LOGIC) ---

  // A. Xử lý Upload Sao kê/Đối soát
  const handleUploadStatement = async (file: File) => {
    try {
      message.loading({ content: "Đang đọc sao kê...", key: "upload" });
      const transactions = await parseBankStatement(file);

      const codes: string[] = [];
      transactions.forEach((t) => {
        const matches = t.description.match(/(SO|DH)[- ]?\d+/gi);
        if (matches) {
          matches.forEach((m) => codes.push(m.replace(" ", "-").toUpperCase()));
        }
      });
      const uniqueCodes = [...new Set(codes)];

      if (uniqueCodes.length === 0) {
        message.warning({
          content: "Không tìm thấy mã SO- nào trong file.",
          key: "upload",
        });
        return false;
      }

      const ordersList = tableProps.dataSource || [];
      // Chỉ tìm những đơn chưa thanh toán (unpaid)
      const matchedIds = ordersList
        .filter(
          (o: any) =>
            uniqueCodes.includes(o.code) && o.payment_status !== "paid"
        )
        .map((o: any) => o.id);

      if (matchedIds.length > 0) {
        setSelectedRowKeys(matchedIds);
        message.success({
          content: `Đã tìm thấy ${matchedIds.length} đơn hàng khớp!`,
          key: "upload",
        });
        setIsPaymentModalOpen(true);
      } else {
        message.info({
          content:
            "Mã đơn trong file không khớp đơn nào đang chờ thanh toán (trên trang này).",
          key: "upload",
        });
      }
    } catch (err: any) {
      message.error({ content: err.message, key: "upload" });
    }
    return false;
  };

  // D. Xuất Excel Misa
  const handleExportInvoiceExcel = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn các đơn hàng cần xuất!");
      return;
    }
    setExportInvoiceLoading(true);
    try {
      const ordersData = await salesService.getOrdersForInvoiceExport(
        selectedRowKeys as string[]
      );
      generateInvoiceExcel(ordersData);
      message.success(`Đã xuất file cho ${ordersData.length} đơn hàng.`);
      setSelectedRowKeys([]);
    } catch (err: any) {
      message.error("Xuất file thất bại: " + err.message);
    } finally {
      setExportInvoiceLoading(false);
    }
  };

  // [NEW] Handler: Khi bấm nút $
  const handlePaymentClick = (order: any) => {
    Modal.confirm({
      title: `Thanh toán đơn ${order.code}`,
      content: "Chọn hình thức thanh toán:",
      okButtonProps: { style: { display: "none" } },
      cancelButtonProps: { style: { display: "none" } },
      closable: true,
      maskClosable: true,
      footer: (_, {}) => (
        <div style={{ textAlign: "right", marginTop: 10 }}>
          <Button onClick={() => Modal.destroyAll()} style={{ marginRight: 8 }}>
            Hủy
          </Button>

          {/* Nút CHUYỂN KHOẢN -> Mở Modal, Set type = bank_transfer */}
          <Button
            onClick={() => {
              Modal.destroyAll();
              setSelectedOrderForPayment(order);
              setInitialPaymentMethod("bank_transfer");
              setFinanceModalOpen(true);
            }}
            style={{ marginRight: 8, borderColor: "#1890ff", color: "#1890ff" }}
          >
            Chuyển khoản
          </Button>
          {/* Nút TIỀN MẶT -> Mở Modal, Set type = cash */}
          <Button
            type="primary"
            onClick={() => {
              Modal.destroyAll();
              setSelectedOrderForPayment(order);
              setInitialPaymentMethod("cash");
              setFinanceModalOpen(true);
            }}
          >
            Tiền mặt
          </Button>
        </div>
      ),
    });
  };

  // [NEW] Xóa đơn
  const handleDelete = (order: any) => {
    Modal.confirm({
      title: "Xác nhận xóa đơn hàng",
      content: `Bạn có chắc muốn xóa đơn ${order.code}? Hành động này không thể hoàn tác.`,
      okType: "danger",
      onOk: async () => {
        try {
          await salesService.deleteOrder(order.id);
          message.success("Đã xóa đơn hàng");
          refresh();
        } catch (e: any) {
          message.error("Lỗi xóa: " + e.message);
        }
      },
    });
  };

  // --- 4. CẤU HÌNH CỘT (COLUMNS DEFINITION) ---
  const columns = useMemo(
    () => [
      // 2. Ngày giờ tạo đơn
      {
        title: "Ngày tạo",
        dataIndex: "created_at",
        width: 140,
        render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
      },
      {
        title: "Hành động",
        key: "action",
        width: 100,
        align: "center" as const,
        render: (_: any, record: any) => (
          <Space>
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={(e) => {
                e.stopPropagation(); // Tránh click vào row nhảy sang trang chi tiết
                printOrder(record);
              }}
            />

            {/* [NEW] Nút In Phiếu Nhặt
                <Button 
                    type="text" 
                    icon={<SnippetsOutlined />} 
                    title="In Phiếu Nhặt Hàng"
                    onClick={(e) => {
                        e.stopPropagation();
                        printPicking(record.id);
                    }}
                />
                 */}
            {/* [NEW] Nút Thanh Toán (Chỉ hiện khi chưa trả hết) */}
            {record.payment_status !== "paid" &&
              record.status !== "CANCELLED" && (
                <Button
                  type="text"
                  title="Thanh toán (Tiền mặt / CK)"
                  style={{ color: "#52c41a" }}
                  icon={<DollarCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePaymentClick(record);
                  }}
                />
              )}

            {/* [NEW] Nút Xóa (Phân quyền) */}
            <Access
              permission={PERMISSIONS.ORDER.DELETE_COMPLETED}
              fallback={
                // Nếu không có quyền xóa đơn đã chốt -> Chỉ hiện nút xóa cho đơn Nháp/Quote/Cancel
                !["COMPLETED", "CONFIRMED", "SHIPPING"].includes(
                  record.status
                ) ? (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(record);
                    }}
                  />
                ) : null
              }
            >
              {/* Nếu có quyền -> Hiện nút xóa cho mọi trạng thái */}
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}
              />
            </Access>
          </Space>
        ),
      },
      // 3. Mã đơn hàng
      {
        title: "Mã đơn",
        dataIndex: "code",
        width: 150,
        render: (code: string) => (
          <Text strong copyable>
            {code}
          </Text>
        ),
      },
      // 4. Tên khách hàng
      {
        title: "Khách hàng",
        dataIndex: "customer_name",
        width: 200,
        render: (name: string, record: any) => (
          <div>
            <Text strong>{name}</Text>
            <div style={{ fontSize: 11, color: "#666" }}>
              {record.customer_phone}
            </div>
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
          <Text strong style={{ color: "#1890ff" }}>
            {new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(val)}
          </Text>
        ),
      },
      // Nhân viên (Creator)
      {
        title: "Nhân viên",
        dataIndex: "creator_name",
        width: 150,
        render: (name: string) => (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ backgroundColor: "#87d068" }}
            />
            <span style={{ fontSize: 12 }}>{name}</span>
          </div>
        ),
      },
      // 6. Trạng thái đơn hàng (Lifecycle)
      {
        title: "TT Đơn",
        dataIndex: "status",
        width: 120,
        render: (status: string) => {
          const map: any = {
            DRAFT: { color: "default", text: "Nháp" },
            QUOTE: { color: "purple", text: "Báo giá" },
            CONFIRMED: { color: "blue", text: "Đã xác nhận" },
            SHIPPING: { color: "cyan", text: "Đang giao" },
            COMPLETED: { color: "green", text: "Hoàn thành" },
            CANCELLED: { color: "red", text: "Đã hủy" },
          };
          const s = map[status] || { color: "default", text: status };
          return <Tag color={s.color}>{s.text}</Tag>;
        },
      },
      // 7. Vận chuyển
      {
        title: "Vận chuyển",
        key: "shipping_status",
        width: 130,
        render: (_: any, record: any) => {
          if (
            record.delivery_method === "self_shipping" ||
            record.order_type === "POS"
          ) {
            return <Tag icon={<ShopOutlined />}>Tại quầy</Tag>;
          }
          if (record.status === "CONFIRMED")
            return (
              <Tag color="orange" icon={<SyncOutlined spin />}>
                Chờ đóng gói
              </Tag>
            );
          if (record.status === "SHIPPING")
            return (
              <Tag color="geekblue" icon={<CarOutlined />}>
                Đang giao
              </Tag>
            );
          if (record.status === "DELIVERED" || record.status === "COMPLETED")
            return <Tag color="green">Đã nhận</Tag>;
          return <Text type="secondary">-</Text>;
        },
      },
      // 8. Thanh toán
      {
        title: "Thanh toán",
        key: "payment_status",
        width: 130,
        render: (_: any, record: any) => {
          const isPaid =
            record.payment_status === "paid" ||
            (record.paid_amount >= record.final_amount &&
              record.final_amount > 0);
          if (isPaid)
            return (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                Đã TT
              </Tag>
            );
          if (record.payment_method === "debt")
            return <Tag color="warning">Công nợ</Tag>;
          return <Tag color="red">Chưa TT</Tag>;
        },
      },
      // 9. VAT Action
      {
        title: "Hóa Đơn",
        key: "invoice_action",
        width: 120,
        align: "center" as const,
        render: (_: any, record: any) => (
          <VatActionButton
            invoice={record.sales_invoice || { id: null, status: "pending" }}
            // Map items từ JSON Array "order_items" của RPC
            orderItems={(record.order_items || []).map((i: any) => ({
              ...i,
              // [FIX CRITICAL] Map id = product_id (BigInt) cho Modal kho
              id: i.product_id,
              // RPC V8 returns "product" object nested inside item
              name: i.product?.name || i.product_name || "Sản phẩm",
              // Logic Unit: Ưu tiên item.uom -> retail/wholesale
              unit:
                i.uom ||
                i.product?.wholesale_unit ||
                i.product?.retail_unit ||
                "Cái",
              price: i.unit_price,
              qty: i.quantity,
              // Pass full product for context if needed
              product: i.product,
            }))}
            customer={{
              name: record.customer_name,
              phone: record.customer_phone,
              tax_code: record.customer_tax_code || "",
              email: record.customer_email || "",
            }}
            onUpdate={() => refresh()}
          />
        ),
      },
    ],
    []
  );

  // --- 5. DATA PREP (STATS) ---
  const selectedOrders = useMemo(() => {
    return (tableProps.dataSource || []).filter((o: any) =>
      selectedRowKeys.includes(o.id)
    );
  }, [tableProps.dataSource, selectedRowKeys]);

  const hasPaidOrder = useMemo(() => {
    return selectedOrders.some((o: any) => o.payment_status === "paid");
  }, [selectedOrders]);

  const totalAmountToCollect = useMemo(() => {
    return selectedOrders.reduce((sum: number, order: any) => {
      const amount = order.final_amount - (order.paid_amount || 0);
      return sum + (amount > 0 ? amount : 0);
    }, 0);
  }, [selectedOrders]);

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
        searchPlaceholder="Tìm mã đơn, SĐT, Tên SP..."
        filterValues={currentFilters}
        filters={[
          {
            key: "status",
            placeholder: "Trạng thái Đơn",
            options: [
              { label: "Đơn Nháp", value: "DRAFT" },
              { label: "Hoàn thành", value: "COMPLETED" },
              { label: "Đang giao", value: "SHIPPING" },
              { label: "Đã xác nhận", value: "CONFIRMED" },
              { label: "Đã hủy", value: "CANCELLED" },
            ],
          },
          {
            key: "paymentStatus",
            placeholder: "Thanh toán",
            options: [
              { label: "Đã thanh toán", value: "paid" },
              { label: "Chưa thanh toán", value: "unpaid" },
              { label: "Công nợ", value: "debt" },
            ],
          },
          {
            key: "invoiceStatus",
            placeholder: "Trạng thái VAT",
            options: [
              { label: "Đã xuất", value: "exported" },
              { label: "Chờ xuất", value: "pending" },
              { label: "Chưa yêu cầu", value: "none" },
            ],
          },
          {
            key: "creatorId",
            placeholder: "Nhân viên",
            options: creators.map((u) => ({
              label:
                u.work_state === "resigned"
                  ? `${u.full_name || u.email} (Đã nghỉ)`
                  : u.full_name || u.email,
              value: u.id,
            })),
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
            ),
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

      {selectedRowKeys.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "#fff",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Space>
            <Text strong>
              Đã chọn{" "}
              <span style={{ color: "#1890ff" }}>{selectedRowKeys.length}</span>{" "}
              đơn hàng
            </Text>
            {hasPaidOrder ? (
              <Text type="danger" style={{ fontSize: 13 }}>
                <WarningOutlined /> Có đơn hàng đã thanh toán trong danh sách
              </Text>
            ) : null}
          </Space>

          <Button
            type="primary"
            style={
              hasPaidOrder
                ? {}
                : { backgroundColor: "#52c41a", borderColor: "#52c41a" }
            }
            icon={<DollarCircleOutlined />}
            disabled={hasPaidOrder}
            onClick={() => setIsPaymentModalOpen(true)}
          >
            Nộp tiền hàng loạt
          </Button>
        </div>
      )}

      <SmartTable
        {...tableProps}
        columns={columns}
        emptyText="Chưa có đơn hàng nào"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/b2b/orders/${record.id}`),
          style: { cursor: "pointer" },
        })}
      />

      {/* MODAL PAYMENT */}
      <Modal
        title={`Xác nhận thu tiền ${selectedRowKeys.length} đơn hàng`}
        open={isPaymentModalOpen}
        confirmLoading={isSubmitting}
        onOk={async () => {
          if (!selectedFundId)
            return message.error("Sếp vui lòng chọn Quỹ nhận tiền!");
          try {
            setIsSubmitting(true);
            message.loading({
              content: "Đang xử lý thu tiền...",
              key: "bulkPay",
            });
            // Gọi API của Nexus
            await b2bService.bulkPayOrders(
              selectedRowKeys as string[],
              selectedFundId,
              note
            );

            // Chờ table reload trước khi đóng modal
            await refresh();

            message.success({
              content: "Đã nộp tiền và chốt nợ thành công!",
              key: "bulkPay",
            });
            setIsPaymentModalOpen(false);
            setSelectedRowKeys([]); // Clear selection
            setNote(""); // Clear ghi chú
          } catch (e: any) {
            message.error({ content: "Lỗi: " + e.message, key: "bulkPay" });
          } finally {
            setIsSubmitting(false);
          }
        }}
        onCancel={() => setIsPaymentModalOpen(false)}
        okText="Xác nhận Thu tiền"
        cancelText="Hủy"
      >
        <div style={{ padding: "8px 0" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 16 }}>Tổng tiền cần thu:</Text>
            <div
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: "#52c41a",
                marginTop: 8,
              }}
            >
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(totalAmountToCollect)}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 500 }}>
              Chọn Quỹ nhận tiền <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              value={selectedFundId}
              onChange={setSelectedFundId}
              options={fundAccounts.map((f) => ({
                label: f.name,
                value: f.id,
              }))}
              placeholder="Chọn quỹ"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 500 }}>Ghi chú:</label>
            <Input.TextArea
              style={{ marginTop: 8 }}
              rows={3}
              placeholder="Nhập ghi chú thu tiền..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* [NEW] FINANCE MODAL INTEGRATION */}
      <FinanceFormModal
        open={financeModalOpen}
        onCancel={() => setFinanceModalOpen(false)}
        initialFlow="in" // Phiếu Thu
        onSuccess={() => {
          setFinanceModalOpen(false);
          refresh(); // Reload bảng để thấy trạng thái "Đã TT"
          message.success("Đã lập phiếu thu thành công!");
        }}
        initialValues={
          selectedOrderForPayment
            ? {
                business_type: "trade",
                partner_type: selectedOrderForPayment.customer_id
                  ? "customer_b2b"
                  : "customer",
                partner_id: selectedOrderForPayment.customer_id, // Auto-select customer
                partner_name: selectedOrderForPayment.customer_name, // Fallback name
                amount: Math.max(
                  0,
                  selectedOrderForPayment.final_amount -
                    (selectedOrderForPayment.paid_amount || 0)
                ), // Số tiền còn thiếu

                ref_type: "order",
                // ⚠️ [CRITICAL] Core yêu cầu: Dùng CODE, không dùng ID
                ref_id: selectedOrderForPayment.code,

                description: `Thu tiền đơn hàng ${selectedOrderForPayment.code}`,

                // Truyền hình thức để Modal tự chọn Quỹ
                payment_method: initialPaymentMethod,
              }
            : undefined
        }
      />

      {/* [NEW] HIDDEN PICKING PRINT */}
      {pickingData ? (
        <div style={{ display: "none" }}>
          <PickingListTemplate
            orderInfo={pickingData.orderInfo}
            items={pickingData.items}
          />
        </div>
      ) : null}
    </div>
  );
};

export default B2BOrderListPage;
