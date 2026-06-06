// src/pages/finance/components/IncomeStatementTable.tsx
// Bảng Kết quả Kinh doanh theo mẫu B02-DNN (Thông tư 200)
import { Table, Typography } from "antd";

import type { IncomeStatement } from "@/features/finance/api/financialReportsService";
import type { ColumnsType } from "antd/es/table";

import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

// ─── Danh sách chỉ tiêu B02-DNN ─────────────────────────────────────────────

type RowVariant = "normal" | "bold" | "bold-highlight";

interface KQKDRow {
  ma_so: string;
  ten_chi_tieu: string;
  field: keyof IncomeStatement | null; // null = dòng tiêu đề nhóm
  variant: RowVariant;
}

const KQKD_ROWS: KQKDRow[] = [
  {
    ma_so: "01",
    ten_chi_tieu: "Doanh thu bán hàng và cung cấp dịch vụ",
    field: "doanh_thu_ban_hang",
    variant: "normal",
  },
  {
    ma_so: "10",
    ten_chi_tieu: "Doanh thu thuần về bán hàng và cung cấp dịch vụ",
    field: "doanh_thu_thuan",
    variant: "bold",
  },
  {
    ma_so: "11",
    ten_chi_tieu: "Giá vốn hàng bán",
    field: "gia_von",
    variant: "normal",
  },
  {
    ma_so: "20",
    ten_chi_tieu: "Lợi nhuận gộp về bán hàng và cung cấp dịch vụ",
    field: "loi_nhuan_gop",
    variant: "bold",
  },
  {
    ma_so: "21",
    ten_chi_tieu: "Doanh thu hoạt động tài chính",
    field: "doanh_thu_tai_chinh",
    variant: "normal",
  },
  {
    ma_so: "22",
    ten_chi_tieu: "Chi phí tài chính",
    field: "chi_phi_tai_chinh",
    variant: "normal",
  },
  {
    ma_so: "25",
    ten_chi_tieu: "Chi phí quản lý kinh doanh",
    field: "chi_phi_qlkd",
    variant: "normal",
  },
  {
    ma_so: "30",
    ten_chi_tieu: "Lợi nhuận thuần từ hoạt động kinh doanh",
    field: "loi_nhuan_thuan",
    variant: "bold",
  },
  {
    ma_so: "31",
    ten_chi_tieu: "Thu nhập khác",
    field: "thu_nhap_khac",
    variant: "normal",
  },
  {
    ma_so: "32",
    ten_chi_tieu: "Chi phí khác",
    field: "chi_phi_khac",
    variant: "normal",
  },
  {
    ma_so: "40",
    ten_chi_tieu: "Lợi nhuận khác",
    field: "loi_nhuan_khac",
    variant: "bold",
  },
  {
    ma_so: "50",
    ten_chi_tieu: "Tổng lợi nhuận kế toán trước thuế",
    field: "tong_loi_nhuan_truoc_thue",
    variant: "bold",
  },
  {
    ma_so: "51",
    ten_chi_tieu: "Chi phí thuế thu nhập doanh nghiệp",
    field: "chi_phi_thue_tndn",
    variant: "normal",
  },
  {
    ma_so: "60",
    ten_chi_tieu: "Lợi nhuận sau thuế thu nhập doanh nghiệp",
    field: "loi_nhuan_sau_thue",
    variant: "bold-highlight",
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  data: IncomeStatement | null;
  fetched: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const IncomeStatementTable: React.FC<Props> = ({ data, fetched }) => {
  const tableData = KQKD_ROWS.map((row) => ({
    ...row,
    so_tien: data && row.field ? data[row.field] : null,
  }));

  const columns: ColumnsType<(typeof tableData)[number]> = [
    {
      title: "Mã số",
      dataIndex: "ma_so",
      width: 80,
      align: "center" as const,
      render: (v: string, row) => (
        <Text strong={row.variant !== "normal"}>{v}</Text>
      ),
    },
    {
      title: "Chỉ tiêu",
      dataIndex: "ten_chi_tieu",
      render: (v: string, row) => (
        <Text strong={row.variant !== "normal"}>{v}</Text>
      ),
    },
    {
      title: "Số tiền (VNĐ)",
      dataIndex: "so_tien",
      align: "right" as const,
      width: 200,
      render: (v: number | null, row) => {
        if (v == null) return null;
        const isBoldHighlight = row.variant === "bold-highlight";
        const isNegative = v < 0;
        return (
          <Text
            strong={row.variant !== "normal"}
            style={{
              color: isBoldHighlight && isNegative ? "#cf1322" : undefined,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtMoney(v)} ₫
          </Text>
        );
      },
    },
  ];

  return (
    <Table
      dataSource={tableData}
      columns={columns}
      rowKey="ma_so"
      size="small"
      bordered
      pagination={false}
      locale={{
        emptyText: fetched ? "Không có dữ liệu" : "Chọn kỳ và nhấn Xem báo cáo",
      }}
      rowClassName={(row) =>
        row.variant === "bold-highlight" ? "kqkd-row-highlight" : ""
      }
    />
  );
};
