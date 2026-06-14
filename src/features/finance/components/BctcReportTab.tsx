import {
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
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
  Alert,
  Tag,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import {
  useBctcReport,
  exportBctcBalanceSheetPdf,
} from "../hooks/useBctcReport";
import { useReconciliationReport } from "../hooks/useReconciliationReport";

import type {
  BalanceSheetRow,
  VatDeclarationRow,
} from "../api/financialReportsService";
import type { ReconciliationReportRow } from "../api/reconciliationService";
import type { TableColumnsType } from "antd";

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
  const [selectedBook, setSelectedBook] = useState<"INTERNAL" | "TAX">(
    "INTERNAL"
  );

  const { balanceSheet, vatDeclaration, cashFlow, isLoading } = useBctcReport({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: reconciliationData, isLoading: reconIsLoading } =
    useReconciliationReport({
      periodYear: selectedYear,
      periodMonth: selectedMonth,
      book: selectedBook,
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

  // ─── Reconciliation columns ────────────────────────────────────────────────

  const reconColumns: TableColumnsType<ReconciliationReportRow> = [
    {
      title: "Tài Khoản",
      dataIndex: "account_code",
      key: "account_code",
      width: "15%",
      align: "center",
    },
    {
      title: "Tên Tài Khoản",
      dataIndex: "account_name",
      key: "account_name",
      width: "30%",
    },
    {
      title: "Số Dư GL (VND)",
      dataIndex: "gl_balance",
      key: "gl_balance",
      width: "18%",
      align: "right",
      render: (text: number) =>
        text?.toLocaleString("vi-VN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) ?? "0",
    },
    {
      title: "Số Dư BS (VND)",
      dataIndex: "bs_balance",
      key: "bs_balance",
      width: "18%",
      align: "right",
      render: (text: number) =>
        text?.toLocaleString("vi-VN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) ?? "0",
    },
    {
      title: "Trạng Thái",
      dataIndex: "is_reconciled",
      key: "is_reconciled",
      width: "12%",
      align: "center",
      render: (reconciled: boolean) =>
        reconciled ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Hòa trộn
          </Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="error">
            Chênh lệch
          </Tag>
        ),
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

  const reconSummary = {
    total: reconciliationData.length,
    reconciled: reconciliationData.filter((r) => r.is_reconciled).length,
    unreconciled: reconciliationData.filter((r) => !r.is_reconciled).length,
  };

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
      label: "Sự Hòa Trộn",
      key: "reconciliation",
      children: (
        <Spin spinning={reconIsLoading}>
          <Space
            direction="vertical"
            style={{ width: "100%", marginBottom: "16px" }}
            size="large"
          >
            <Select
              style={{ width: 150 }}
              value={selectedBook}
              onChange={(val) => setSelectedBook(val)}
              options={[
                { label: "Sổ Thực Tế (Internal)", value: "INTERNAL" },
                { label: "Sổ Thuế (Tax)", value: "TAX" },
              ]}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "16px",
              }}
            >
              <Alert
                message={`Tổng TK: ${reconSummary.total}`}
                type="info"
                showIcon
              />
              <Alert
                message={`Hòa Trộn: ${reconSummary.reconciled}`}
                type="success"
                showIcon
              />
              <Alert
                message={`Chênh Lệch: ${reconSummary.unreconciled}`}
                type={reconSummary.unreconciled > 0 ? "warning" : "success"}
                showIcon
              />
            </div>
            {reconciliationData.length > 0 ? (
              <Table
                columns={reconColumns}
                dataSource={reconciliationData}
                rowKey={(record) => record.account_code}
                pagination={false}
                scroll={{ x: 1000 }}
              />
            ) : (
              <Empty description="Không có dữ liệu" />
            )}
          </Space>
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
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
              }}
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
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
              }}
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
