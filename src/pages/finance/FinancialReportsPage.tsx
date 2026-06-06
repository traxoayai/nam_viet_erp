// src/pages/finance/FinancialReportsPage.tsx
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
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { IncomeStatementTable } from "./components/IncomeStatementTable";

import type {
  GetReportParams,
  IncomeStatement,
  TrialBalanceRow,
} from "@/features/finance/api/financialReportsService";
import type { Book } from "@/features/finance/types/accounting";
import type { ColumnsType } from "antd/es/table";

import { PERMISSIONS } from "@/features/auth/constants/permissions";
import { financialReportsService } from "@/features/finance/api/financialReportsService";
import { PermissionGuard } from "@/shared/components/auth/PermissionGuard";
import { fmtMoney } from "@/shared/utils/money";

const { Content } = Layout;
const { Text } = Typography;

// ─── Cột Bảng CĐTK ──────────────────────────────────────────────────────────

const MONEY_CELL = (v: number) => (
  <Text style={{ fontVariantNumeric: "tabular-nums" }}>
    {v ? fmtMoney(v) : ""}
  </Text>
);

const trialBalanceColumns: ColumnsType<TrialBalanceRow> = [
  {
    title: "Số hiệu TK",
    dataIndex: "account_code",
    width: 110,
    fixed: "left" as const,
  },
  {
    title: "Tên tài khoản",
    dataIndex: "account_name",
    ellipsis: true,
    fixed: "left" as const,
  },
  {
    title: "Dư đầu kỳ",
    children: [
      {
        title: "Nợ",
        dataIndex: "opening_debit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
      {
        title: "Có",
        dataIndex: "opening_credit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
    ],
  },
  {
    title: "Phát sinh kỳ",
    children: [
      {
        title: "Nợ",
        dataIndex: "period_debit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
      {
        title: "Có",
        dataIndex: "period_credit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
    ],
  },
  {
    title: "Dư cuối kỳ",
    children: [
      {
        title: "Nợ",
        dataIndex: "closing_debit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
      {
        title: "Có",
        dataIndex: "closing_credit",
        align: "right" as const,
        width: 140,
        render: MONEY_CELL,
      },
    ],
  },
];

// ─── Component tổng dòng CĐTK ───────────────────────────────────────────────

function sumCol(rows: TrialBalanceRow[], key: keyof TrialBalanceRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function buildSummary(rows: TrialBalanceRow[]) {
  const keys: (keyof TrialBalanceRow)[] = [
    "opening_debit",
    "opening_credit",
    "period_debit",
    "period_credit",
    "closing_debit",
    "closing_credit",
  ];

  return (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: "#fafafa" }}>
        <Table.Summary.Cell index={0} colSpan={2}>
          Tổng cộng
        </Table.Summary.Cell>
        {keys.map((k, i) => (
          <Table.Summary.Cell key={k} index={i + 2} align="right">
            {fmtMoney(sumCol(rows, k))}
          </Table.Summary.Cell>
        ))}
      </Table.Summary.Row>
    </Table.Summary>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = dayjs().year();
const CURRENT_MONTH = dayjs().month() + 1; // dayjs tháng 0-based

const FinancialReportsPage: React.FC = () => {
  const { message } = App.useApp();

  const [book, setBook] = useState<Book>("INTERNAL");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [month, setMonth] = useState<number>(CURRENT_MONTH);
  const [loading, setLoading] = useState(false);

  const [trialData, setTrialData] = useState<TrialBalanceRow[]>([]);
  const [incomeData, setIncomeData] = useState<IncomeStatement | null>(null);
  const [fetched, setFetched] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    const params: GetReportParams = { book, year, month };
    try {
      const [trial, income] = await Promise.all([
        financialReportsService.getTrialBalance(params),
        financialReportsService.getIncomeStatement(params),
      ]);
      setTrialData(trial);
      setIncomeData(income);
      setFetched(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const filterBar = (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} sm={12} md={5}>
          <Select<Book>
            value={book}
            style={{ width: "100%" }}
            onChange={setBook}
            options={[
              { label: "Sổ Nội bộ", value: "INTERNAL" },
              { label: "Sổ Thuế", value: "TAX" },
            ]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <DatePicker
            picker="month"
            style={{ width: "100%" }}
            value={dayjs(`${year}-${String(month).padStart(2, "0")}-01`)}
            onChange={(date) => {
              if (date) {
                setYear(date.year());
                setMonth(date.month() + 1);
              }
            }}
            format="MM/YYYY"
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={6} md={4}>
          <Button type="primary" loading={loading} onClick={handleFetch}>
            Xem báo cáo
          </Button>
        </Col>
      </Row>
    </Card>
  );

  const tabItems = [
    {
      key: "income",
      label: "Kết quả kinh doanh (B02-DNN)",
      children: (
        <Card>
          <IncomeStatementTable data={incomeData} fetched={fetched} />
        </Card>
      ),
    },
    {
      key: "trial",
      label: "Bảng cân đối tài khoản",
      children: (
        <Card>
          <Table<TrialBalanceRow>
            dataSource={fetched ? trialData : []}
            columns={trialBalanceColumns}
            rowKey="account_code"
            loading={loading}
            size="small"
            bordered
            scroll={{ x: 1100 }}
            pagination={false}
            locale={{
              emptyText: fetched
                ? "Không có dữ liệu"
                : "Chọn kỳ và nhấn Xem báo cáo",
            }}
            summary={
              fetched && trialData.length > 0
                ? () => buildSummary(trialData)
                : undefined
            }
          />
        </Card>
      ),
    },
  ];

  return (
    <PermissionGuard permission={PERMISSIONS.FINANCE.VIEW_BALANCE}>
      <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
        <Content
          style={{
            padding: 24,
            maxWidth: 1600,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Space direction="vertical" style={{ width: "100%" }} size={0}>
            <Typography.Title level={4} style={{ margin: "0 0 16px" }}>
              Báo Cáo Tài Chính
            </Typography.Title>

            {filterBar}

            <Tabs defaultActiveKey="income" items={tabItems} />
          </Space>
        </Content>
      </Layout>
    </PermissionGuard>
  );
};

export default FinancialReportsPage;
