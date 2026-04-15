import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Tag,
  Button,
  Select,
  Typography,
  Space,
  Card,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

import { safeRpc } from "@/shared/lib/safeRpc";
import {
  AppNotification,
  NotificationCategory,
  useNotificationStore,
} from "@/features/settings/stores/useNotificationStore";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "portal_order", label: "Đơn hàng Portal", color: "blue" },
  { value: "portal_registration", label: "Đăng ký Portal", color: "cyan" },
  { value: "payment_received", label: "Thanh toán", color: "green" },
  { value: "sales_payment", label: "Tiền về", color: "green" },
  { value: "expense_approval", label: "Duyệt chi", color: "orange" },
  { value: "purchase_order", label: "Đơn mua hàng", color: "purple" },
  { value: "task_update", label: "Công việc", color: "geekblue" },
];

function getCategoryTag(category: string | null | undefined) {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
  if (!opt) return <Tag>Khác</Tag>;
  return <Tag color={opt.color}>{opt.label}</Tag>;
}

function getNotificationLink(noti: {
  category?: NotificationCategory | null;
  reference_id?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = noti.metadata as Record<string, unknown> | null;
  switch (noti.category) {
    case "purchase_order": {
      const poId = meta?.po_id;
      return poId ? `/purchase-orders/${poId}` : "/purchase-orders";
    }
    case "expense_approval":
    case "payment_received":
    case "sales_payment":
      return "/finance/transactions";
    case "portal_order":
      return noti.reference_id
        ? `/b2b/orders/${noti.reference_id}`
        : "/b2b/orders";
    case "portal_registration":
      return "/portal/registrations";
    case "task_update":
      return "/hr/kpi";
    default:
      return null;
  }
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  category: string | null;
  metadata: Record<string, unknown> | null;
  reference_id: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const [data, setData] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: result, error } = await safeRpc("get_my_notifications", {
      p_category: category || null,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });
    if (!error && result) {
      const parsed = result as { data: NotificationRow[]; total: number };
      setData(parsed.data ?? []);
      setTotal(parsed.total ?? 0);
    }
    setLoading(false);
  }, [page, category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAllRead = async () => {
    markAllAsRead();
    await safeRpc("mark_all_my_notifications_read", undefined, {
      silent: true,
    });
    fetchData();
  };

  const handleRowClick = async (record: NotificationRow) => {
    if (!record.is_read) {
      await safeRpc(
        "mark_notification_read",
        { p_noti_id: record.id },
        { silent: true }
      );
    }
    const link = getNotificationLink(record as AppNotification);
    if (link) navigate(link);
  };

  const columns = [
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (text: string, record: NotificationRow) => (
        <Typography.Text strong={!record.is_read}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: "Loại",
      dataIndex: "category",
      key: "category",
      width: 160,
      render: (cat: string | null) => getCategoryTag(cat),
    },
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (d: string) => (
        <Typography.Text type="secondary">
          {dayjs(d).fromNow()}
        </Typography.Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 40,
      render: (_: unknown, record: NotificationRow) => {
        const link = getNotificationLink(record as AppNotification);
        return link ? (
          <ArrowRightOutlined style={{ color: "#1890ff" }} />
        ) : null;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          Thông báo
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Lọc theo loại"
            style={{ width: 200 }}
            options={CATEGORY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={category}
            onChange={(val) => {
              setCategory(val);
              setPage(1);
            }}
          />
          <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            Đọc tất cả
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: {
              cursor: getNotificationLink(record as AppNotification)
                ? "pointer"
                : "default",
              background: record.is_read ? undefined : "#e6f7ff",
            },
          })}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `${t} thông báo`,
          }}
        />
      </Card>
    </div>
  );
}
