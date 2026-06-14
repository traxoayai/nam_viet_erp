// src/pages/finance/components/JournalEntryDrawer.tsx
import { CheckOutlined, CloseCircleOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import type {
  JournalEntry,
  JournalLineDetail,
} from "@/features/finance/types/accounting";
import type { ColumnsType } from "antd/es/table";

import { PERMISSIONS } from "@/features/auth/constants/permissions";
import { accountingService } from "@/features/finance/api/accountingService";
import { journalLedgerService } from "@/features/finance/api/journalLedgerService";
import { Access } from "@/shared/components/auth/Access";
import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

const BOOK_LABEL: Record<string, string> = {
  vat: "Sổ VAT",
  actual: "Sổ Thực",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  purchase: "Mua hàng",
  sale: "Bán hàng",
  cogs: "Giá vốn",
  receipt: "Thu tiền",
  payment: "Chi tiền",
  closing: "Kết chuyển",
};

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  draft: { color: "default", text: "Nháp" },
  posted: { color: "success", text: "Đã duyệt" },
  void: { color: "red", text: "Đã hủy" },
};

interface Props {
  entry: JournalEntry | null;
  open: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
}

const lineColumns: ColumnsType<JournalLineDetail> = [
  {
    title: "STT",
    dataIndex: "line_no",
    width: 50,
    render: (_: number, __: JournalLineDetail, idx: number) => idx + 1,
  },
  {
    title: "Tài khoản",
    key: "account",
    render: (_: unknown, row: JournalLineDetail) =>
      `${row.account_code} - ${row.account_name}`,
  },
  {
    title: "Nợ",
    dataIndex: "debit",
    align: "right" as const,
    render: (v: number) => (v > 0 ? <Text>{fmtMoney(v)} ₫</Text> : "--"),
  },
  {
    title: "Có",
    dataIndex: "credit",
    align: "right" as const,
    render: (v: number) => (v > 0 ? <Text>{fmtMoney(v)} ₫</Text> : "--"),
  },
  {
    title: "Đối tượng",
    dataIndex: "partner_id",
    render: (v: string | null) => v ?? "--",
  },
  {
    title: "Diễn giải",
    dataIndex: "description",
    ellipsis: true,
    render: (v: string | null) => v ?? "--",
  },
];

export const JournalEntryDrawer: React.FC<Props> = ({
  entry,
  open,
  onClose,
  onActionSuccess,
}) => {
  const { message } = App.useApp();
  const [lines, setLines] = useState<JournalLineDetail[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!open || !entry) {
      setLines([]);
      return;
    }
    setLoadingLines(true);
    journalLedgerService
      .getJournalLines(entry.id)
      .then(setLines)
      .catch((err: Error) => message.error(err.message))
      .finally(() => setLoadingLines(false));
  }, [open, entry?.id]);

  const handlePost = async () => {
    if (!entry) return;
    setActionLoading(true);
    try {
      await accountingService.postEntry(entry.id);
      message.success("Duyệt bút toán thành công");
      onActionSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Lỗi duyệt bút toán");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!entry) return;
    setActionLoading(true);
    try {
      await accountingService.voidEntry(entry.id);
      message.success("Hủy bút toán thành công");
      onActionSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Lỗi hủy bút toán");
    } finally {
      setActionLoading(false);
    }
  };

  const statusCfg = entry
    ? (STATUS_CONFIG[entry.status] ?? { color: "default", text: entry.status })
    : null;

  const footer = entry ? (
    <Space>
      {entry.status === "draft" && (
        <Access permission={PERMISSIONS.FINANCE.POST_JOURNAL}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={actionLoading}
            onClick={handlePost}
          >
            Duyệt
          </Button>
        </Access>
      )}
      {(entry.status === "draft" || entry.status === "posted") && (
        <Access permission={PERMISSIONS.FINANCE.VOID_JOURNAL}>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            loading={actionLoading}
            onClick={handleVoid}
          >
            Hủy
          </Button>
        </Access>
      )}
      <Button onClick={onClose}>Đóng</Button>
    </Space>
  ) : (
    <Button onClick={onClose}>Đóng</Button>
  );

  return (
    <Drawer
      title="Chi tiết Bút toán"
      open={open}
      onClose={onClose}
      width={860}
      footer={footer}
    >
      {entry ? (
        <>
          <Descriptions
            bordered
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Ngày">
              {dayjs(entry.entry_date).format("DD/MM/YYYY")}
            </Descriptions.Item>
            <Descriptions.Item label="Sổ">
              {BOOK_LABEL[entry.book] ?? entry.book}
            </Descriptions.Item>
            <Descriptions.Item label="Loại chứng từ">
              {DOC_TYPE_LABEL[entry.doc_type] ?? entry.doc_type}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {statusCfg ? (
                <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng Nợ">
              <Text strong>{fmtMoney(entry.total_debit)} ₫</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Tổng Có">
              <Text strong>{fmtMoney(entry.total_credit)} ₫</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Diễn giải" span={2}>
              {entry.description ?? "--"}
            </Descriptions.Item>
          </Descriptions>

          <Table<JournalLineDetail>
            dataSource={lines}
            columns={lineColumns}
            rowKey="id"
            loading={loadingLines}
            size="small"
            pagination={false}
            scroll={{ x: 700 }}
          />
        </>
      ) : null}
    </Drawer>
  );
};
