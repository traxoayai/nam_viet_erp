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

const statusMap: any = {
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
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({});
  const [stats, setStats] = useState({ pending: 0, amount: 0 });
  const [isXmlUploadOpen, setIsXmlUploadOpen] = useState(false);
  const [isScanUploadOpen, setIsScanUploadOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [unlinkedInvoices, setUnlinkedInvoices] = useState<any[]>([]);
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

      const invoiceIds = allocations.map((a: any) => a.invoice_id);
      const allocationMap = Object.fromEntries(
        allocations.map((a: any) => [a.invoice_id, a.allocated_amount])
      );

      let query = supabase
        .from("finance_invoices")
        .select("*, suppliers:supplier_id(name)")
        .in("id", invoiceIds)
        .order("created_at", { ascending: false });

      if (filters.status) query = query.eq("status", filters.status);
      if (filters.search) {
        query = query.or(
          `invoice_number.ilike.%${filters.search}%,supplier_name_raw.ilike.%${filters.search}%`
        );
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      const mapped = (invoices || []).map((inv: any) => ({
        ...inv,
        allocated_amount: allocationMap[inv.id] || 0,
      }));

      setData(mapped);

      const pendingCount = mapped.filter(
        (i: any) => i.status === "draft"
      ).length;
      const totalAmt = moneySum(
        mapped.map((i: any) => i.total_amount_post_tax || 0)
      );
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
  const [linkFilters, setLinkFilters] = useState<any>({});

  const fetchUnlinkedInvoices = async (overrideFilters?: any) => {
    setLinkLoading(true);
    try {
      const f = overrideFilters || linkFilters;

      // Get all invoice IDs already linked to ANY PO
      const { data: allAllocations } = await supabase
        .from("finance_invoice_allocations")
        .select("invoice_id");
      const allLinkedIds = (allAllocations || []).map((a: any) => a.invoice_id);

      let query = supabase
        .from("finance_invoices")
        .select(
          "id, invoice_number, invoice_symbol, invoice_date, supplier_name_raw, supplier_id, total_amount_post_tax, status, suppliers:supplier_id(name)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (f.search) {
        query = query.or(
          `invoice_number.ilike.%${f.search}%,supplier_name_raw.ilike.%${f.search}%`
        );
      }
      if (f.status) {
        query = query.eq("status", f.status);
      }
      if (f.dateFrom && f.dateTo) {
        query = query
          .gte("invoice_date", f.dateFrom)
          .lte("invoice_date", f.dateTo);
      }

      const { data: allInvoices, error } = await query;
      if (error) throw error;

      const available = (allInvoices || []).filter(
        (inv: any) => !allLinkedIds.includes(inv.id)
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

  const handleLinkInvoice = async (invoiceId: number, totalAmount: number = 0) => {
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
    } catch (err: any) {
      message.error("Lỗi liên kết: " + err.message);
    }
  };

  const columns = [
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (status: string) => {
        const s = statusMap[status] || { color: "default", text: status };
        return (
          <Tag icon={s.icon} color={s.color}>
            {s.text}
          </Tag>
        );
      },
    },
    {
      title: "Số Hóa Đơn",
      dataIndex: "invoice_number",
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text || "(Chưa có số)"}</Text>
          <div style={{ fontSize: 12, color: "#888" }}>
            KH: {record.invoice_symbol}
          </div>
        </div>
      ),
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
      render: (text: string, record: any) =>
        text || record.suppliers?.name || "--",
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
      render: (_: any, record: any) => (
        <Space>
          <Tooltip
            title={
              record.status === "draft" ? "Đối chiếu ngay" : "Xem chi tiết"
            }
          >
            <Button
              type={record.status === "draft" ? "primary" : "default"}
              size="small"
              icon={
                record.status === "draft" ? <ScanOutlined /> : <EyeOutlined />
              }
              onClick={() =>
                navigate(
                  `/finance/invoices/verify/${record.id}?returnTo=${encodeURIComponent(`/purchase-orders/${poId}?tab=invoice`)}`
                )
              }
            />
          </Tooltip>
          <Popconfirm
            title="Gỡ liên kết hóa đơn khỏi đơn hàng?"
            onConfirm={() => handleUnlink(record.id)}
          >
            <Tooltip title="Gỡ liên kết">
              <Button icon={<DisconnectOutlined />} size="small" type="text" />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="Xóa hóa đơn này?"
            onConfirm={() => handleDelete(record.id)}
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
      ),
    },
  ];

  const linkColumns = [
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (status: string) => {
        const s = statusMap[status] || { color: "default", text: status };
        return (
          <Tag icon={s.icon} color={s.color}>
            {s.text}
          </Tag>
        );
      },
    },
    {
      title: "Số Hóa Đơn",
      dataIndex: "invoice_number",
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text || "(Chưa có số)"}</Text>
          <div style={{ fontSize: 12, color: "#888" }}>
            KH: {record.invoice_symbol}
          </div>
        </div>
      ),
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
      render: (text: string, record: any) =>
        text || record.suppliers?.name || "--",
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
      render: (_: any, record: any) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleLinkInvoice(record.id, record.total_amount_post_tax || 0)}
        >
          Liên kết
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 12 }} align="stretch">
        {/* Left 60%: stats + payment button */}
        <Col span={14} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row gutter={12} style={{ flex: 1 }}>
            <Col span={12} style={{ display: "flex" }}>
              <Card bordered={false} styles={{ body: { padding: "12px 16px" } }} style={{ flex: 1 }}>
                <Statistic
                  title="Hóa đơn chờ đối chiếu"
                  value={stats.pending}
                  valueStyle={{ color: "#faad14", fontSize: 20 }}
                  prefix={<ScanOutlined />}
                />
              </Card>
            </Col>
            <Col span={12} style={{ display: "flex" }}>
              <Card bordered={false} styles={{ body: { padding: "12px 16px" } }} style={{ flex: 1 }}>
                <Statistic
                  title="Tổng tiền hóa đơn"
                  value={stats.amount}
                  valueStyle={{ color: "#3f8600", fontSize: 20 }}
                  prefix={<DollarCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        </Col>
        {/* Right 40%: action buttons */}
        <Col span={10} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setIsScanUploadOpen(true)}
            className="mb-3"
          >
            Scan Ảnh (AI Gemini)
          </Button>
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => setIsXmlUploadOpen(true)}
            className="mb-3"
          >
            Nhập XML (Chuẩn Thuế)
          </Button>
          <Button
            icon={<LinkOutlined />}
            onClick={handleOpenLinkModal}
            loading={linkLoading}
          >
            Liên kết HĐ có sẵn
          </Button>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <FilePdfOutlined /> Hóa đơn VAT của Đơn hàng
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
                  setFilters({ ...filters, search: e.target.value })
                }
                allowClear
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="Trạng thái"
                allowClear
                style={{ width: "100%" }}
                onChange={(val) => setFilters({ ...filters, status: val })}
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
                {onOpenCreateInvoice && (
                  <Button type="primary" icon={<FileTextOutlined />} onClick={onOpenCreateInvoice}>
                    Tạo Hóa Đơn Mới
                  </Button>
                )}
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
                  const newFilters = { ...linkFilters, search: e.target.value };
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
                  const newFilters = { ...linkFilters, status: val };
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
                onChange={(dates: any) => {
                  const newFilters = {
                    ...linkFilters,
                    dateFrom: dates?.[0]?.toISOString(),
                    dateTo: dates?.[1]?.toISOString(),
                  };
                  setLinkFilters(newFilters);
                  fetchUnlinkedInvoices(newFilters);
                }}
              />
            </Col>
            <Col span={4} style={{ textAlign: "right" }}>
              <Button
                icon={<SyncOutlined />}
                onClick={() => fetchUnlinkedInvoices(linkFilters)}
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
