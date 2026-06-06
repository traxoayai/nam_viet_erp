// src/pages/finance/components/BalanceSheetTable.tsx
// Bảng cân đối kế toán theo mẫu B01a-DNN (Thông tư 133)
import { Space, Table, Typography } from "antd";

import type { BalanceSheetRow } from "@/features/finance/api/financialReportsService";
import type { ColumnsType } from "antd/es/table";

import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

// Mã số thuộc NGUỒN VỐN; còn lại coi là TÀI SẢN.
const NGUON_VON_CODES = new Set(["300", "400"]);

interface Props {
  data: BalanceSheetRow[];
  fetched: boolean;
  loading: boolean;
}

function sumSoTien(rows: BalanceSheetRow[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.so_tien) || 0), 0);
}

const columns: ColumnsType<BalanceSheetRow> = [
  {
    title: "Mã số",
    dataIndex: "ma_so",
    width: 90,
    align: "center" as const,
  },
  {
    title: "Chỉ tiêu",
    dataIndex: "ten_chi_tieu",
    ellipsis: true,
  },
  {
    title: "Số tiền (VNĐ)",
    dataIndex: "so_tien",
    align: "right" as const,
    width: 220,
    render: (v: number) => (
      <Text style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(v)}</Text>
    ),
  },
];

function buildSummary(rows: BalanceSheetRow[], label: string) {
  return (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: "#fafafa" }}>
        <Table.Summary.Cell index={0} colSpan={2}>
          {label}
        </Table.Summary.Cell>
        <Table.Summary.Cell index={2} align="right">
          <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(sumSoTien(rows))}
          </Text>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );
}

function SectionTable({
  title,
  rows,
  totalLabel,
  fetched,
  loading,
}: {
  title: string;
  rows: BalanceSheetRow[];
  totalLabel: string;
  fetched: boolean;
  loading: boolean;
}) {
  return (
    <div>
      <Typography.Title level={5} style={{ margin: "0 0 8px" }}>
        {title}
      </Typography.Title>
      <Table<BalanceSheetRow>
        dataSource={fetched ? rows : []}
        columns={columns}
        rowKey="ma_so"
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
          fetched && rows.length > 0
            ? () => buildSummary(rows, totalLabel)
            : undefined
        }
      />
    </div>
  );
}

export const BalanceSheetTable: React.FC<Props> = ({
  data,
  fetched,
  loading,
}) => {
  const taiSan = data.filter((r) => !NGUON_VON_CODES.has(r.ma_so));
  const nguonVon = data.filter((r) => NGUON_VON_CODES.has(r.ma_so));

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={24}>
      <SectionTable
        title="TÀI SẢN"
        rows={taiSan}
        totalLabel="TỔNG TÀI SẢN"
        fetched={fetched}
        loading={loading}
      />
      <SectionTable
        title="NGUỒN VỐN"
        rows={nguonVon}
        totalLabel="TỔNG NGUỒN VỐN"
        fetched={fetched}
        loading={loading}
      />
    </Space>
  );
};
