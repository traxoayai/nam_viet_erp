import { useState } from "react";
import {
  Card,
  Tabs,
  Table,
  Button,
  DatePicker,
  Space,
  Select,
  Empty,
  Spin,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { useBctcReport, exportBctcBalanceSheetPdf } from "../hooks/useBctcReport";
import type {
  BalanceSheetRow,
  VatDeclarationRow,
} from "../api/financialReportsService";

interface BctcReportTabProps {
  year?: number;
  month?: number;
}

/**
 * BCTC Report Tab — Bảng cân đối kế toán B01a-DNN, Khai báo VAT, Lưu chuyển tiền tệ
 * - Hiển thị 3 tab: Balance Sheet, VAT Declaration, Cash Flow
 * - Cho phép chọn tháng/năm
 * - Xuất PDF (placeholder)
 */
export default function BctcReportTab({
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
}: BctcReportTabProps) {
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState(month);

  const { balanceSheet, vatDeclaration, cashFlow, isLoading } = useBctcReport({
    year: selectedYear,
    month: selectedMonth,
  });

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedYear(date.year());
      setSelectedMonth(date.month() + 1);
    }
  };

  const handleExportPDF = async () => {
    await exportBctcBalanceSheetPdf(balanceSheet, selectedYear, selectedMonth);
  };

  // ─── Balance Sheet columns ───────────────────────────────────────────────────

  const bsColumns: TableColumnsType<BalanceSheetRow> = [
    {
      title: "Chỉ Tiêu",
      dataIndex: "ten_chi_tieu",
      key: "ten_chi_tieu",
      width: "60%",
    },
    {
      title: "Mã Số",
      dataIndex: "ma_so",
      key: "ma_so",
      width: "15%",
      align: "center",
    },
    {
      title: "Giá Trị (VND)",
      dataIndex: "so_tien",
      key: "so_tien",
      width: "25%",
      align: "right",
      render: (text: number) =>
        text?.toLocaleString("vi-VN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) ?? "0",
    },
  ];

  // ─── VAT Declaration columns ────────────────────────────────────────────────

  const vatColumns: TableColumnsType<VatDeclarationRow> = [
    {
      title: "Thuế Suất (%)",
      dataIndex: "tax_rate",
      key: "tax_rate",
      width: "20%",
      align: "center",
    },
    {
      title: "Doanh Thu Trước Thuế (VND)",
      dataIndex: "sum_pre_tax",
      key: "sum_pre_tax",
      width: "40%",
      align: "right",
      render: (text: number) =>
        text?.toLocaleString("vi-VN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) ?? "0",
    },
    {
      title: "Thuế VAT (VND)",
      dataIndex: "sum_vat",
      key: "sum_vat",
      width: "40%",
      align: "right",
      render: (text: number) =>
        text?.toLocaleString("vi-VN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) ?? "0",
    },
  ];

  // ─── Tab items ───────────────────────────────────────────────────────────────

  const tabItems = [
    {
      label: "Bảng Cân Đối",
      key: "balance_sheet",
      children: (
        <Spin spinning={isLoading}>
          {balanceSheet.length > 0 ? (
            <Table
              columns={bsColumns}
              dataSource={balanceSheet}
              rowKey={(record) => record.ma_so}
              pagination={false}
              scroll={{ x: 800 }}
            />
          ) : (
            <Empty description="Không có dữ liệu" />
          )}
        </Spin>
      ),
    },
    {
      label: "Khai Báo VAT",
      key: "vat_declaration",
      children: (
        <Spin spinning={isLoading}>
          {vatDeclaration.length > 0 ? (
            <Table
              columns={vatColumns}
              dataSource={vatDeclaration}
              rowKey={(_, idx) => `vat-${idx}`}
              pagination={false}
              scroll={{ x: 800 }}
            />
          ) : (
            <Empty description="Không có dữ liệu" />
          )}
        </Spin>
      ),
    },
    {
      label: "Lưu Chuyển Tiền Tệ",
      key: "cash_flow",
      children: (
        <Spin spinning={isLoading}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tiền vào:</span>
              <span>
                {cashFlow.dong_tien_vao.toLocaleString("vi-VN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                VND
              </span>
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}
            >
              <span>Tiền ra:</span>
              <span>
                {cashFlow.dong_tien_ra.toLocaleString("vi-VN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                VND
              </span>
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}
            >
              <strong>Lưu chuyển thuần:</strong>
              <strong>
                {cashFlow.luu_chuyen_thuan.toLocaleString("vi-VN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                VND
              </strong>
            </div>
          </div>
        </Spin>
      ),
    },
  ];

  return (
    <Card
      title="Báo Cáo Tài Chính (BCTC B01a-DNN)"
      extra={
        <Space>
          <Select
            style={{ width: 100 }}
            value={selectedMonth}
            onChange={(val) => setSelectedMonth(val)}
            options={Array.from({ length: 12 }, (_, i) => ({
              label: `Tháng ${i + 1}`,
              value: i + 1,
            }))}
          />
          <Select
            style={{ width: 100 }}
            value={selectedYear}
            onChange={(val) => setSelectedYear(val)}
            options={Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return { label: `${y}`, value: y };
            })}
          />
          <DatePicker
            picker="month"
            value={dayjs(`${selectedYear}-${selectedMonth}`)}
            onChange={handleDateChange}
            placeholder="Chọn tháng"
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportPDF}
          >
            Xuất PDF
          </Button>
        </Space>
      }
    >
      <Tabs items={tabItems} />
    </Card>
  );
}
