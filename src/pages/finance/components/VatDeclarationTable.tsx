// src/pages/finance/components/VatDeclarationTable.tsx
// Bảng kê thuế GTGT đầu vào (mua) và đầu ra (bán)
import { Space, Table, Typography } from "antd";

import type { VatDeclarationRow } from "@/features/finance/api/financialReportsService";
import type { ColumnsType } from "antd/es/table";

import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

interface Props {
  inbound: VatDeclarationRow[];
  outbound: VatDeclarationRow[];
  fetched: boolean;
  loading: boolean;
}

const MONEY_CELL = (v: number) => (
  <Text style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(v)}</Text>
);

const columns: ColumnsType<VatDeclarationRow> = [
  {
    title: "Thuế suất (%)",
    dataIndex: "tax_rate",
    width: 130,
    align: "center" as const,
    render: (v: number) => (
      <Text style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(v)}</Text>
    ),
  },
  {
    title: "Tiền hàng chưa thuế",
    dataIndex: "sum_pre_tax",
    align: "right" as const,
    render: MONEY_CELL,
  },
  {
    title: "Tiền thuế",
    dataIndex: "sum_vat",
    align: "right" as const,
    render: MONEY_CELL,
  },
];

function sumKey(
  rows: VatDeclarationRow[],
  key: "sum_pre_tax" | "sum_vat"
): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function buildSummary(rows: VatDeclarationRow[]) {
  return (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: "#fafafa" }}>
        <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">
          <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(sumKey(rows, "sum_pre_tax"))}
          </Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={2} align="right">
          <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(sumKey(rows, "sum_vat"))}
          </Text>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );
}

function VatSection({
  title,
  rows,
  fetched,
  loading,
}: {
  title: string;
  rows: VatDeclarationRow[];
  fetched: boolean;
  loading: boolean;
}) {
  return (
    <div>
      <Typography.Title level={5} style={{ margin: "0 0 8px" }}>
        {title}
      </Typography.Title>
      <Table<VatDeclarationRow>
        dataSource={fetched ? rows : []}
        columns={columns}
        rowKey="tax_rate"
        loading={loading}
        size="small"
        bordered
        pagination={false}
        locale={{
          emptyText: fetched
            ? "Không có dữ liệu"
            : "Chọn kỳ và nhấn Xem báo cáo",
        }}
        summary={
          fetched && rows.length > 0 ? () => buildSummary(rows) : undefined
        }
      />
    </div>
  );
}

export const VatDeclarationTable: React.FC<Props> = ({
  inbound,
  outbound,
  fetched,
  loading,
}) => (
  <Space direction="vertical" style={{ width: "100%" }} size={24}>
    <VatSection
      title="Thuế GTGT đầu vào (mua)"
      rows={inbound}
      fetched={fetched}
      loading={loading}
    />
    <VatSection
      title="Thuế GTGT đầu ra (bán)"
      rows={outbound}
      fetched={fetched}
      loading={loading}
    />
  </Space>
);
