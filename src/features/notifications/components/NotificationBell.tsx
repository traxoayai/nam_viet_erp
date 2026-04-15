// src/features/notifications/components/NotificationBell.tsx
import { BellOutlined } from "@ant-design/icons";
import { Badge, Button, List, Popover, Typography, Empty, Avatar } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import {
  useNotificationStore,
  AppNotification,
} from "@/features/settings/stores/useNotificationStore";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

/** Map category → route ERP */
function getNotificationLink(noti: AppNotification): string | null {
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

export const NotificationBell = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Dùng store thay vì local state — NotificationContext đã subscribe realtime
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const markAsReadInStore = useNotificationStore((s) => s.markAsRead);

  // 1. Tải thông báo ban đầu vào store
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data as AppNotification[]);
      }
    };

    fetchNotifications();
  }, [user, setNotifications]);

  // 2. Realtime đã được xử lý bởi NotificationContext — không cần subscribe lại

  // 3. Đánh dấu đã đọc + navigate đến trang nguồn
  const handleClick = async (item: AppNotification) => {
    // Optimistic Update qua store
    if (!item.is_read) {
      markAsReadInStore(item.id);
      await safeRpc(
        "mark_notification_read",
        { p_noti_id: item.id },
        { silent: true }
      );
    }

    // Navigate đến trang nguồn
    const link = getNotificationLink(item);
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  // UI Danh sách
  const content = (
    <div style={{ width: 350, maxHeight: 400, overflowY: "auto" }}>
      <List
        dataSource={notifications}
        locale={{ emptyText: <Empty description="Không có thông báo mới" /> }}
        renderItem={(item) => {
          const hasLink = !!getNotificationLink(item);
          return (
            <List.Item
              style={{
                background: item.is_read ? "white" : "#e6f7ff",
                cursor: "pointer",
                padding: "8px 12px",
              }}
              onClick={() => handleClick(item)}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    style={{
                      backgroundColor:
                        item.type === "warning" ? "#ff4d4f" : "#1890ff",
                    }}
                    icon={<BellOutlined />}
                  />
                }
                title={
                  <Typography.Text
                    strong={!item.is_read}
                    style={hasLink ? { color: "#1890ff" } : undefined}
                  >
                    {item.title}
                  </Typography.Text>
                }
                description={
                  <div>
                    <div>{item.message}</div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                      {dayjs(item.created_at).fromNow()}
                    </div>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      title="Thông báo"
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Button type="text" shape="circle">
        <Badge count={unreadCount} overflowCount={99} size="small">
          <BellOutlined style={{ fontSize: 20 }} />
        </Badge>
      </Button>
    </Popover>
  );
};
