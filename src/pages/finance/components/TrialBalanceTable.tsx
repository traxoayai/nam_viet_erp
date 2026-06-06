// src/pages/finance/components/TrialBalanceTable.tsx
// Bảng cân đối tài khoản — số dư đầu kỳ / phát sinh / cuối kỳ
import { Table, Typography } from "antd";

import type { TrialBalanceRow } from "@/features/finance/api/financialReportsService";
import type { ColumnsType } from "antd/es/table";

import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

interface Props {
  data: TrialBalanceRow[];
  fetched: boolean;
  loading: boolean;
}

const MONEY_CELL = (v: number) => (
  <Text style={{ fontVariantNumeric: "tabular-nums" }}>
    {v ? fmtMoney(v) : ""}
  </Text>
);

const columns: ColumnsType<TrialBalanceRow> = [
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

export const TrialBalanceTable: React.FC<Props> = ({
  data,
  fetched,
  loading,
}) => (
  <Table<TrialBalanceRow>
    dataSource={fetched ? data : []}
    columns={columns}
    rowKey="account_code"
    loading={loading}
    size="small"
    bordered
    scroll={{ x: 1100 }}
    pagination={false}
    locale={{
      emptyText: fetched ? "Không có dữ liệu" : "Chọn kỳ và nhấn Xem báo cáo",
    }}
    summary={fetched && data.length > 0 ? () => buildSummary(data) : undefined}
  />
);
