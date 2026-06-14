// Journal Entry Page — Minimal stub version
// - Display journal entries qua hook useJournalEntries
// - Integrate với router

import { Button, Card, DatePicker, Select, Space, Table, Tag } from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { useJournalEntries } from "../hooks/useAccountingData";

import type { Book, JournalEntry, JournalStatus } from "../types/accounting";
import type { ColumnsType } from "antd/es/table";

import { fmtMoney } from "@/shared/utils/money";

const BOOK_COLOR: Record<string, string> = {
  TAX: "blue",
  INTERNAL: "green",
};

const STATUS_CONFIG: Record<JournalStatus, { color: string; text: string }> = {
  draft: { color: "default", text: "Nháp" },
  posted: { color: "success", text: "Đã duyệt" },
  void: { color: "red", text: "Đã hủy" },
};

const JournalEntryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    book?: Book;
    status?: JournalStatus;
    dateFrom?: string;
    dateTo?: string;
  }>({});

  const PAGE_SIZE = 20;
  const { entries, total, isLoading } = useJournalEntries({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: ColumnsType<JournalEntry> = [
    {
      title: "Mã Bút Toán",
      dataIndex: "id",
      key: "id",
      width: 100,
    },
    {
      title: "Ngày",
      dataIndex: "entry_date",
      key: "entry_date",
      width: 120,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Loại",
      dataIndex: "doc_type",
      key: "doc_type",
      width: 100,
    },
    {
      title: "Sổ",
      dataIndex: "book",
      key: "book",
      width: 100,
      render: (book: Book) => (
        <Tag color={BOOK_COLOR[book]}>
          {book === "TAX" ? "Sổ Thuế" : "Sổ Nội bộ"}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: JournalStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "Nợ",
      dataIndex: "total_debit",
      key: "total_debit",
      width: 120,
      align: "right" as const,
      render: (amount: number) => fmtMoney(amount),
    },
    {
      title: "Có",
      dataIndex: "total_credit",
      key: "total_credit",
      width: 120,
      align: "right" as const,
      render: (amount: number) => fmtMoney(amount),
    },
  ];

  return (
    <Card title="Sổ Nhật Ký Kế Toán">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Chọn sổ"
          style={{ width: 150 }}
          allowClear
          onChange={(value) =>
            setFilters((f) => ({ ...f, book: value as Book | undefined }))
          }
          options={[
            { label: "Sổ Nội bộ", value: "INTERNAL" },
            { label: "Sổ Thuế", value: "TAX" },
          ]}
        />
        <DatePicker.RangePicker
          onChange={(dates) => {
            setFilters((f) => ({
              ...f,
              dateFrom: dates?.[0]?.format("YYYY-MM-DD"),
              dateTo: dates?.[1]?.format("YYYY-MM-DD"),
            }));
          }}
        />
        <Button
          onClick={() => {
            setPage(1);
            setFilters({});
          }}
        >
          Reset
        </Button>
      </Space>

      <Table
        dataSource={entries}
        columns={columns}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (newPage) => setPage(newPage),
        }}
        rowKey="id"
      />
    </Card>
  );
};

export default JournalEntryPage;
