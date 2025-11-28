// src/pages/finance/invoices/InvoiceListPage.tsx
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
  DownloadOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  App,
  Tooltip,
  Popconfirm,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Nhớ cài: npm install xlsx

import InvoiceUploadModal from "./InvoiceUploadModal";

import { invoiceService } from "@/services/invoiceService";

const { Content } = Layout;
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

const InvoiceListPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<any>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, amount: 0 });

  useEffect(() => {
    fetchData();
  }, [pagination.current, JSON.stringify(filters)]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, total } = await invoiceService.getInvoices(
        pagination.current,
        pagination.pageSize,
        filters
      );
      setData(data);
      setPagination((prev) => ({ ...prev, total }));

      const pendingCount = data.filter((i) => i.status === "draft").length;
      const totalAmt = data.reduce(
        (sum, i) => sum + (i.total_amount_post_tax || 0),
        0
      );
      setStats({ total, pending: pendingCount, amount: totalAmt });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoiceService.deleteInvoice(id);
      message.success("Đã xóa hóa đơn");
      fetchData();
    } catch (error) {
      message.error("Xóa thất bại");
    }
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    if (data.length === 0) return message.warning("Không có dữ liệu để xuất");

    const exportData = data.map((inv) => ({
      "Số HĐ": inv.invoice_number,
      "Ký hiệu": inv.invoice_symbol,
      "Ngày HĐ": inv.invoice_date,
      "Nhà Cung Cấp": inv.supplier_name_raw || "(Chưa map)",
      "Tổng tiền (Sau thuế)": inv.total_amount_post_tax || 0,
      "Trạng thái": inv.status === "verified" ? "Đã nhập kho" : "Chờ xử lý",
      "Ngày nhập": dayjs(inv.created_at).format("DD/MM/YYYY HH:mm"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachHoaDon");
    XLSX.writeFile(workbook, `DS_HoaDon_${dayjs().format("DDMMYYYY")}.xlsx`);
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
    { title: "Nhà Cung Cấp", dataIndex: "supplier_name_raw", ellipsis: true },
    {
      title: "Tổng Tiền",
      dataIndex: "total_amount_post_tax",
      align: "right" as const,
      render: (v: number) => <Text strong>{v?.toLocaleString()} ₫</Text>,
    },
    {
      title: "Hành động",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space>
          {/* Nút Xem/Đối chiếu */}
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
              onClick={() => navigate(`/finance/invoices/verify/${record.id}`)}
            />
          </Tooltip>

          <Popconfirm
            title="Xóa hóa đơn này?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} size="small" type="text" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{ padding: 24, maxWidth: 1400, margin: "0 auto", width: "100%" }}
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic
                title="Hóa đơn chờ đối chiếu"
                value={stats.pending}
                valueStyle={{ color: "#faad14" }}
                prefix={<ScanOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic
                title="Tổng tiền (Trang này)"
                value={stats.amount}
                valueStyle={{ color: "#3f8600" }}
                prefix={<DollarCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              style={{ width: "100%", height: "100%", fontSize: 16 }}
              onClick={() => setIsUploadOpen(true)}
            >
              Tải Hóa Đơn Mới (AI Scan)
            </Button>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              <FilePdfOutlined /> Kho Hóa Đơn Số
            </Space>
          }
          styles={{ body: { padding: 0 } }}
          extra={
            <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
          }
        >
          <div style={{ padding: 24, borderBottom: "1px solid #f0f0f0" }}>
            <Row gutter={16}>
              <Col span={8}>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm số hóa đơn, NCC..."
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                />
              </Col>
              <Col span={6}>
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
              <Col span={6}>
                <RangePicker
                  style={{ width: "100%" }}
                  onChange={(dates) =>
                    setFilters({
                      ...filters,
                      dateFrom: dates?.[0]?.toISOString(),
                      dateTo: dates?.[1]?.toISOString(),
                    })
                  }
                />
              </Col>
              <Col span={4} style={{ textAlign: "right" }}>
                <Button icon={<SyncOutlined />} onClick={fetchData}>
                  Làm mới
                </Button>
              </Col>
            </Row>
          </div>
          <Table
            dataSource={data}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              onChange: (page, pageSize) =>
                setPagination({ ...pagination, current: page, pageSize }),
            }}
          />
        </Card>

        <InvoiceUploadModal
          open={isUploadOpen}
          onCancel={() => {
            setIsUploadOpen(false);
            fetchData();
          }}
        />
      </Content>
    </Layout>
  );
};

export default InvoiceListPage;
