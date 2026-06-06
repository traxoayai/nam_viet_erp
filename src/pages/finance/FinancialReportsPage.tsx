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
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { BalanceSheetTable } from "./components/BalanceSheetTable";
import { CashFlowTable } from "./components/CashFlowTable";
import { IncomeStatementTable } from "./components/IncomeStatementTable";
import { TrialBalanceTable } from "./components/TrialBalanceTable";
import { VatDeclarationTable } from "./components/VatDeclarationTable";

import type {
  BalanceSheetRow,
  CashFlow,
  GetReportParams,
  IncomeStatement,
  TrialBalanceRow,
  VatDeclarationRow,
} from "@/features/finance/api/financialReportsService";
import type { Book } from "@/features/finance/types/accounting";

import { PERMISSIONS } from "@/features/auth/constants/permissions";
import { financialReportsService } from "@/features/finance/api/financialReportsService";
import { PermissionGuard } from "@/shared/components/auth/PermissionGuard";

const { Content } = Layout;

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
  const [balanceData, setBalanceData] = useState<BalanceSheetRow[]>([]);
  const [vatIn, setVatIn] = useState<VatDeclarationRow[]>([]);
  const [vatOut, setVatOut] = useState<VatDeclarationRow[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [fetched, setFetched] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    const params: GetReportParams = { book, year, month };
    try {
      const [trial, income, balance, vIn, vOut, cash] = await Promise.all([
        financialReportsService.getTrialBalance(params),
        financialReportsService.getIncomeStatement(params),
        financialReportsService.getBalanceSheet(params),
        financialReportsService.getVatDeclaration({
          direction: "inbound",
          year,
          month,
        }),
        financialReportsService.getVatDeclaration({
          direction: "outbound",
          year,
          month,
        }),
        financialReportsService.getCashFlow(params),
      ]);
      setTrialData(trial);
      setIncomeData(income);
      setBalanceData(balance);
      setVatIn(vIn);
      setVatOut(vOut);
      setCashFlow(cash);
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
          <TrialBalanceTable
            data={trialData}
            fetched={fetched}
            loading={loading}
          />
        </Card>
      ),
    },
    {
      key: "balance",
      label: "Bảng cân đối KT (B01a)",
      children: (
        <Card>
          <BalanceSheetTable
            data={balanceData}
            fetched={fetched}
            loading={loading}
          />
        </Card>
      ),
    },
    {
      key: "vat",
      label: "Bảng kê thuế GTGT",
      children: (
        <Card>
          <VatDeclarationTable
            inbound={vatIn}
            outbound={vatOut}
            fetched={fetched}
            loading={loading}
          />
        </Card>
      ),
    },
    {
      key: "cashflow",
      label: "Lưu chuyển tiền tệ",
      children: (
        <Card>
          <CashFlowTable data={cashFlow} fetched={fetched} />
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
