// src/pages/finance/JournalLedgerPage.tsx
import { LockOutlined, SyncOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Layout,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { ClosePeriodModal } from "./components/ClosePeriodModal";
import { JournalEntryDrawer } from "./components/JournalEntryDrawer";

import type {
  Book,
  JournalEntry,
  JournalStatus,
} from "@/features/finance/types/accounting";
import type { ColumnsType } from "antd/es/table";

import { PERMISSIONS } from "@/features/auth/constants/permissions";
import { journalLedgerService } from "@/features/finance/api/journalLedgerService";
import { Access } from "@/shared/components/auth/Access";
import { fmtMoney } from "@/shared/utils/money";

const { Content } = Layout;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const BOOK_LABEL: Record<string, string> = {
  TAX: "Sổ Thuế",
  INTERNAL: "Sổ Nội bộ",
};
const BOOK_COLOR: Record<string, string> = {
  TAX: "blue",
  INTERNAL: "green",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  purchase: "Mua hàng",
  sale: "Bán hàng",
  cogs: "Giá vốn",
  receipt: "Thu tiền",
  payment: "Chi tiền",
  closing: "Kết chuyển",
};

const STATUS_CONFIG: Record<JournalStatus, { color: string; text: string }> = {
  draft: { color: "default", text: "Nháp" },
  posted: { color: "success", text: "Đã duyệt" },
  void: { color: "red", text: "Đã hủy" },
};

interface Filters {
  book?: Book;
  status?: JournalStatus;
  docType?: string;
  dateFrom?: string;
  dateTo?: string;
}

const PAGE_SIZE = 20;

const JournalLedgerPage: React.FC = () => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [closePeriodOpen, setClosePeriodOpen] = useState(false);

  const fetchData = async (currentPage = page, currentFilters = filters) => {
    setLoading(true);
    try {
      const result = await journalLedgerService.listJournalEntries({
        ...currentFilters,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, filters);
  }, [page, JSON.stringify(filters)]);

  const handleFilterChange = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
  };

  const handleRowClick = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setDrawerOpen(true);
  };

  const handleActionSuccess = () => {
    fetchData(page, filters);
  };

  const columns: ColumnsType<JournalEntry> = [
    {
      title: "Ngày",
      dataIndex: "entry_date",
      width: 110,
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Sổ",
      dataIndex: "book",
      width: 90,
      render: (book: string) => (
        <Tag color={BOOK_COLOR[book] ?? "default"}>
          {BOOK_LABEL[book] ?? book}
        </Tag>
      ),
    },
    {
      title: "Loại CT",
      dataIndex: "doc_type",
      width: 110,
      render: (t: string) => DOC_TYPE_LABEL[t] ?? t,
    },
    {
      title: "Diễn giải",
      dataIndex: "description",
      ellipsis: true,
      render: (v: string | null) => v ?? "--",
    },
    {
      title: "Tổng Nợ",
      dataIndex: "total_debit",
      align: "right" as const,
      width: 140,
      render: (v: number) => <Text>{fmtMoney(v)} ₫</Text>,
    },
    {
      title: "Tổng Có",
      dataIndex: "total_credit",
      align: "right" as const,
      width: 140,
      render: (v: number) => <Text>{fmtMoney(v)} ₫</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (s: JournalStatus) => {
        const cfg = STATUS_CONFIG[s] ?? { color: "default", text: s };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{ padding: 24, maxWidth: 1600, margin: "0 auto", width: "100%" }}
      >
        <Card
          title={
            <Space>
              <span>Sổ Nhật Ký Kế Toán</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<SyncOutlined />}
                onClick={() => fetchData(page, filters)}
              >
                Làm mới
              </Button>
              <Access permission={PERMISSIONS.FINANCE.CLOSE_PERIOD}>
                <Button
                  icon={<LockOutlined />}
                  danger
                  onClick={() => setClosePeriodOpen(true)}
                >
                  Khóa kỳ
                </Button>
              </Access>
            </Space>
          }
        >
          {/* Bộ lọc */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={5}>
              <Select
                placeholder="Sổ"
                allowClear
                style={{ width: "100%" }}
                onChange={(val: Book | undefined) =>
                  handleFilterChange({ book: val })
                }
              >
                <Select.Option value="TAX">Sổ Thuế</Select.Option>
                <Select.Option value="INTERNAL">Sổ Nội bộ</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Select
                placeholder="Trạng thái"
                allowClear
                style={{ width: "100%" }}
                onChange={(val: JournalStatus | undefined) =>
                  handleFilterChange({ status: val })
                }
              >
                <Select.Option value="draft">Nháp</Select.Option>
                <Select.Option value="posted">Đã duyệt</Select.Option>
                <Select.Option value="void">Đã hủy</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Select
                placeholder="Loại chứng từ"
                allowClear
                style={{ width: "100%" }}
                onChange={(val: string | undefined) =>
                  handleFilterChange({ docType: val })
                }
              >
                <Select.Option value="purchase">Mua hàng</Select.Option>
                <Select.Option value="sale">Bán hàng</Select.Option>
                <Select.Option value="cogs">Giá vốn</Select.Option>
                <Select.Option value="receipt">Thu tiền</Select.Option>
                <Select.Option value="payment">Chi tiền</Select.Option>
                <Select.Option value="closing">Kết chuyển</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={9}>
              <RangePicker
                style={{ width: "100%" }}
                placeholder={["Từ ngày", "Đến ngày"]}
                onChange={(dates) =>
                  handleFilterChange({
                    dateFrom: dates?.[0]?.format("YYYY-MM-DD"),
                    dateTo: dates?.[1]?.format("YYYY-MM-DD"),
                  })
                }
              />
            </Col>
          </Row>

          <Table<JournalEntry>
            dataSource={data}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="middle"
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: "pointer" },
            })}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              showTotal: (t) => `Tổng ${t} bút toán`,
              onChange: (p) => setPage(p),
            }}
          />
        </Card>
      </Content>

      <JournalEntryDrawer
        entry={selectedEntry}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onActionSuccess={handleActionSuccess}
      />

      <ClosePeriodModal
        open={closePeriodOpen}
        onClose={() => setClosePeriodOpen(false)}
        onSuccess={handleActionSuccess}
      />
    </Layout>
  );
};

export default JournalLedgerPage;
