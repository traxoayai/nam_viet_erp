// src/features/finance/components/invoices/InvoiceVerifySection.tsx
// Embedded invoice list for a specific PO - same UI as InvoiceListPage
import {
  CloudUploadOutlined,
  SearchOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  EyeOutlined,
  ScanOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  LinkOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import {
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Tooltip,
  Popconfirm,
  Modal,
  App,
  DatePicker,
} from "antd";
import dayjs from "dayjs";
import { type ChangeEvent, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { InvoiceXmlUpload } from "./InvoiceXmlUpload";

import { invoiceService } from "@/features/finance/api/invoiceService";
import InvoiceUploadModal from "@/pages/finance/invoices/InvoiceUploadModal";
import { supabase } from "@/shared/lib/supabaseClient";
import { moneySum, fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  draft: {
    color: "orange",
    text: "Chờ đối chiếu",
    icon: <ScanOutlined spin />,
  },
  verified: {
    color: "green",
    text: "Đã nhập kho",
    icon: <CheckCircleOutlined />,
  },
  rejected: { color: "red", text: "Từ chối", icon: <DeleteOutlined /> },
};

interface InvoiceVerifySectionProps {
  poId?: number | string;
  refreshKey?: number;
  onOpenCreateInvoice?: () => void;
  onRequestPayment?: () => void;
}

const InvoiceVerifySection = ({
  poId,
  refreshKey,
  onOpenCreateInvoice,
  onRequestPayment: _onRequestPayment,
}: InvoiceVerifySectionProps) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);
  const [filters, setFilters] = useState<unknown>({});
  const [stats, setStats] = useState({ pending: 0, amount: 0 });
  const [isXmlUploadOpen, setIsXmlUploadOpen] = useState(false);
  const [isScanUploadOpen, setIsScanUploadOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [unlinkedInvoices, setUnlinkedInvoices] = useState<unknown[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  // Fetch invoices linked to this PO
  const fetchData = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const { data: allocations, error: allocError } = await supabase
        .from("finance_invoice_allocations")
        .select("invoice_id, allocated_amount")
        .eq("po_id", Number(poId));

      if (allocError) throw allocError;

      if (!allocations || allocations.length === 0) {
        setData([]);
        setStats({ pending: 0, amount: 0 });
        setLoading(false);
        return;
      }

      const invoiceIds = allocations.map((a) => (a as Record<string, unknown>).invoice_id) as number[];
      const allocationMap = Object.fromEntries(
        allocations.map((a) => [(a as Record<string, unknown>).invoice_id, (a as Record<string, unknown>).allocated_amount])
      ) as Record<number, number>;

      let query = supabase
        .from("finance_invoices")
        .select("*, suppliers:supplier_id(name)")
        .in("id", invoiceIds)
        .order("created_at", { ascending: false });

      if ((filters as Record<string, unknown>).status) query = query.eq("status", (filters as Record<string, unknown>).status as string);
      if ((filters as Record<string, unknown>).search) {
        query = query.or(
          `invoice_number.ilike.%${(filters as Record<string, unknown>).search}%,supplier_name_raw.ilike.%${(filters as Record<string, unknown>).search}%`
        );
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      const mapped = (invoices || []).map((inv: unknown) => {
        const invRec = inv as Record<string, unknown>;
        return {
          ...invRec,
          allocated_amount: allocationMap[invRec.id as number] || 0,
        };
      });

      setData(mapped);

      const pendingCount = mapped.filter(
        (i: unknown) => (i as Record<string, unknown>).status === "draft"
      ).length;
      const amounts: number[] = mapped.map((i: unknown) => (i as Record<string, unknown>).total_amount_post_tax as number || 0);
      const totalAmt = (moneySum(amounts) as number) || 0;
      setStats({ pending: pendingCount, amount: totalAmt });
    } catch (err) {
      console.error("Fetch PO invoices error:", err);
    } finally {
      setLoading(false);
    }
  }, [poId, filters, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    try {
      await invoiceService.deleteInvoice(id);
      message.success("Đã xóa hóa đơn");
      fetchData();
    } catch {
      message.error("Xóa thất bại");
    }
  };

  // Unlink invoice from this PO
  const handleUnlink = async (invoiceId: number) => {
    try {
      const { error } = await supabase
        .from("finance_invoice_allocations")
        .delete()
        .eq("invoice_id", invoiceId)
        .eq("po_id", Number(poId));
      if (error) throw error;
      message.success("Đã gỡ liên kết hóa đơn khỏi đơn hàng");
      fetchData();
    } catch {
      message.error("Gỡ liên kết thất bại");
    }
  };

  // Link existing invoice to this PO
  const [linkFilters, setLinkFilters] = useState<unknown>({});

  const fetchUnlinkedInvoices = async (overrideFilters?: unknown) => {
    setLinkLoading(true);
    try {
      const f = overrideFilters || linkFilters;

      // Get all invoice IDs already linked to ANY PO
      const { data: allAllocations } = await supabase
        .from("finance_invoice_allocations")
        .select("invoice_id");
      const allLinkedIds = ((allAllocations || []).map(
        (a: unknown) => (a as Record<string, unknown>).invoice_id
      ) as number[]);

      let query = supabase
        .from("finance_invoices")
        .select(
          "id, invoice_number, invoice_symbol, invoice_date, supplier_name_raw, supplier_id, total_amount_post_tax, status, suppliers:supplier_id(name)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if ((f as Record<string, unknown>).search) {
        query = query.or(
          `invoice_number.ilike.%${(f as Record<string, unknown>).search}%,supplier_name_raw.ilike.%${(f as Record<string, unknown>).search}%`
        );
      }
      if ((f as Record<string, unknown>).status) {
        query = query.eq("status", (f as Record<string, unknown>).status as string);
      }
      if ((f as Record<string, unknown>).dateFrom && (f as Record<string, unknown>).dateTo) {
        query = query
          .gte("invoice_date", (f as Record<string, unknown>).dateFrom as string)
          .lte("invoice_date", (f as Record<string, unknown>).dateTo as string);
      }

      const { data: allInvoices, error } = await query;
      if (error) throw error;

      const available = (allInvoices || []).filter(
        (inv: unknown) => !allLinkedIds.includes((inv as Record<string, unknown>).id as number)
      );

      setUnlinkedInvoices(available);
    } catch {
      message.error("Lỗi tải danh sách hóa đơn");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleOpenLinkModal = async () => {
    setLinkFilters({});
    setIsLinkModalOpen(true);
    await fetchUnlinkedInvoices({});
  };

  const handleLinkInvoice = async (
    invoiceId: number,
    totalAmount: number = 0
  ) => {
    try {
      const { error } = await supabase
        .from("finance_invoice_allocations")
        .insert({
          invoice_id: invoiceId,
          po_id: Number(poId),
          allocated_amount: totalAmount,
        });

      if (error) throw error;
      message.success("Đã liên kết hóa đơn với đơn mua hàng");
      setIsLinkModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      message.error("Lỗi liên kết: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    }
  };

  const columns = [
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (status: string) => {
        const s = (statusMap[status] || { color: "default", text: status }) as Record<string, unknown>;
        return (
          <Tag icon={s.icon as React.ReactNode} color={s.color as string}>
            {s.text as React.ReactNode}
          </Tag>
        );
      },
    },
    {
      title: "Số Hóa Đơn",
      dataIndex: "invoice_number",
      render: (text: string, record: unknown) => {
        const rec = record as Record<string, unknown>;
        return (
          <div>
            <Text strong>{text || "(Chưa có số)"}</Text>
            <div style={{ fontSize: 12, color: "#888" }}>
              KH: {rec.invoice_symbol as React.ReactNode}
            </div>
          </div>
        );
      },
    },
    {
      title: "Ngày HĐ",
      dataIndex: "invoice_date",
      render: (d: string) => (d ? dayjs(d).format("DD/MM/YYYY") : "--"),
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name_raw",
      ellipsis: true,
      render: (text: string, record: unknown) =>
        (text as React.ReactNode) || ((record as Record<string, unknown>).suppliers as Record<string, unknown>)?.name as React.ReactNode || "--",
    },
    {
      title: "Tổng Tiền",
      dataIndex: "total_amount_post_tax",
      align: "right" as const,
      render: (v: number) => <Text strong>{fmtMoney(v)} ₫</Text>,
    },
    {
      title: "Hành động",
      align: "center" as const,
      render: (_: unknown, record: unknown) => {
        const rec = record as Record<string, unknown>;
        return (
          <Space>
            <Tooltip
              title={
                rec.status === "draft" ? "Đối chiếu ngay" : "Xem chi tiết"
              }
            >
              <Button
                type={rec.status === "draft" ? "primary" : "default"}
                size="small"
                icon={
                  rec.status === "draft" ? <ScanOutlined /> : <EyeOutlined />
                }
                onClick={() =>
                  navigate(
                    `/finance/invoices/verify/${rec.id}?returnTo=${encodeURIComponent(`/purchase-orders/${poId}?tab=invoice`)}`
                  )
                }
              />
            </Tooltip>
            <Popconfirm
              title="Gỡ liên kết hóa đơn khỏi đơn hàng?"
              onConfirm={() => handleUnlink(rec.id as number)}
            >
              <Tooltip title="Gỡ liên kết">
                <Button icon={<DisconnectOutlined />} size="small" type="text" />
              </Tooltip>
            </Popconfirm>
            <Popconfirm
              title="Xóa hóa đơn này?"
              onConfirm={() => handleDelete(rec.id as number)}
            >
              <Tooltip title="Xóa hóa đơn">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const linkColumns = [
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (status: string) => {
        const s = (statusMap[status] || { color: "default", text: status }) as Record<string, unknown>;
        return (
          <Tag icon={s.icon as React.ReactNode} color={s.color as string}>
            {s.text as React.ReactNode}
          </Tag>
        );
      },
    },
    {
      title: "Số Hóa Đơn",
      dataIndex: "invoice_number",
      render: (text: string, record: unknown) => {
        const rec = record as Record<string, unknown>;
        return (
          <div>
            <Text strong>{text || "(Chưa có số)"}</Text>
            <div style={{ fontSize: 12, color: "#888" }}>
              KH: {rec.invoice_symbol as React.ReactNode}
            </div>
          </div>
        );
      },
    },
    {
      title: "Ngày HĐ",
      dataIndex: "invoice_date",
      render: (d: string) => (d ? dayjs(d).format("DD/MM/YYYY") : "--"),
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name_raw",
      ellipsis: true,
      render: (text: string, record: unknown) =>
        (text as React.ReactNode) || ((record as Record<string, unknown>).suppliers as Record<string, unknown>)?.name as React.ReactNode || "--",
    },
    {
      title: "Tổng Tiền",
      dataIndex: "total_amount_post_tax",
      align: "right" as const,
      render: (v: number) => <Text strong>{fmtMoney(v)} ₫</Text>,
    },
    {
      title: "Hành động",
      align: "center" as const,
      width: 100,
      render: (_: unknown, record: unknown) => {
        const rec = record as Record<string, unknown>;
        return (
          <Button
            type="primary"
            size="small"
            onClick={() =>
              handleLinkInvoice(rec.id as number, (rec.total_amount_post_tax as number) || 0)
            }
          >
            Liên kết
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 12 }} align="stretch">
        <Col span={12} style={{ display: "flex" }}>
          <Card
            bordered={false}
            styles={{ body: { padding: "12px 16px" } }}
            style={{ flex: 1 }}
          >
            <Statistic
              title="Hóa đơn chờ đối chiếu"
              value={stats.pending}
              valueStyle={{ color: "#faad14", fontSize: 20 }}
              prefix={<ScanOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} style={{ display: "flex" }}>
          <Card
            bordered={false}
            styles={{ body: { padding: "12px 16px" } }}
            style={{ flex: 1 }}
          >
            <Statistic
              title="Tổng tiền hóa đơn"
              value={stats.amount}
              valueStyle={{ color: "#3f8600", fontSize: 20 }}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <FilePdfOutlined /> Hóa đơn VAT của Đơn hàng
          </Space>
        }
        extra={
          <Space size="small">
            <Button
              size="small"
              icon={<CloudUploadOutlined />}
              onClick={() => setIsScanUploadOpen(true)}
              style={{
                borderColor: "#52c41a",
                color: "#52c41a",
                boxShadow: "0 1px 4px rgba(82, 196, 26, 0.3)",
              }}
            >
              Scan Ảnh (AI Gemini)
            </Button>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setIsXmlUploadOpen(true)}
              style={{
                borderColor: "#1677ff",
                color: "#1677ff",
                boxShadow: "0 1px 4px rgba(22, 119, 255, 0.3)",
              }}
            >
              Nhập XML (Chuẩn Thuế)
            </Button>
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={handleOpenLinkModal}
              loading={linkLoading}
              style={{
                borderColor: "#722ed1",
                color: "#722ed1",
                boxShadow: "0 1px 4px rgba(114, 46, 209, 0.3)",
              }}
            >
              Liên kết HĐ có sẵn
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 24, borderBottom: "1px solid #f0f0f0" }}>
          <Row gutter={16}>
            <Col span={8}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="Tìm số hóa đơn, NCC..."
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFilters({ ...(filters as Record<string, unknown>), search: e.target.value })
                }
                allowClear
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="Trạng thái"
                allowClear
                style={{ width: "100%" }}
                onChange={(val) => setFilters({ ...(filters as Record<string, unknown>), status: val })}
              >
                <Select.Option value="draft">Chờ đối chiếu</Select.Option>
                <Select.Option value="verified">Đã nhập kho</Select.Option>
              </Select>
            </Col>
            <Col flex="auto" style={{ textAlign: "right" }}>
              <Space>
                <Button icon={<SyncOutlined />} onClick={fetchData}>
                  Làm mới
                </Button>
                {onOpenCreateInvoice ? (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={onOpenCreateInvoice}
                  >
                    Tạo Hóa Đơn Mới
                  </Button>
                ) : null}
              </Space>
            </Col>
          </Row>
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: "Chưa có hóa đơn nào liên kết với đơn hàng này",
          }}
        />
      </Card>

      <InvoiceXmlUpload
        open={isXmlUploadOpen}
        onCancel={() => {
          setIsXmlUploadOpen(false);
          fetchData();
        }}
        returnTo={poId ? `/purchase-orders/${poId}?tab=invoice` : undefined}
        poId={poId}
      />

      <Modal
        title="Liên kết Hóa đơn có sẵn"
        open={isLinkModalOpen}
        onCancel={() => setIsLinkModalOpen(false)}
        footer={null}
        width={1100}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0" }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="Tìm số hóa đơn, NCC..."
                allowClear
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const newFilters = { ...(linkFilters as Record<string, unknown>), search: e.target.value };
                  setLinkFilters(newFilters);
                  fetchUnlinkedInvoices(newFilters);
                }}
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="Trạng thái"
                allowClear
                style={{ width: "100%" }}
                onChange={(val: string) => {
                  const newFilters = { ...(linkFilters as Record<string, unknown>), status: val };
                  setLinkFilters(newFilters);
                  fetchUnlinkedInvoices(newFilters);
                }}
              >
                <Select.Option value="draft">Chờ đối chiếu</Select.Option>
                <Select.Option value="verified">Đã nhập kho</Select.Option>
              </Select>
            </Col>
            <Col span={7}>
              <RangePicker
                style={{ width: "100%" }}
                onChange={(dates: unknown) => {
                  const datesArr = dates as unknown[];
                  const newFilters = {
                    ...(linkFilters as Record<string, unknown>),
                    dateFrom: datesArr?.[0] && (datesArr[0] as { toISOString: () => string }).toISOString(),
                    dateTo: datesArr?.[1] && (datesArr[1] as { toISOString: () => string }).toISOString(),
                  };
                  setLinkFilters(newFilters);
                  fetchUnlinkedInvoices(newFilters);
                }}
              />
            </Col>
            <Col span={4} style={{ textAlign: "right" }}>
              <Button
                icon={<SyncOutlined />}
                onClick={() => fetchUnlinkedInvoices(linkFilters as Record<string, unknown>)}
              >
                Làm mới
              </Button>
            </Col>
          </Row>
        </div>
        <Table
          dataSource={unlinkedInvoices}
          columns={linkColumns}
          rowKey="id"
          loading={linkLoading}
          pagination={{ pageSize: 10, size: "small", showSizeChanger: false }}
          locale={{
            emptyText: "Không có hóa đơn nào chưa liên kết",
          }}
        />
      </Modal>

      <InvoiceUploadModal
        open={isScanUploadOpen}
        onCancel={() => {
          setIsScanUploadOpen(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default InvoiceVerifySection;
