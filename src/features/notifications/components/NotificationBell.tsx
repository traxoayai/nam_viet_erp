// src/features/notifications/components/NotificationBell.tsx
import { BellOutlined } from "@ant-design/icons";
import { Badge, Button, List, Popover, Typography, Empty, Avatar } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect } from "react";

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

export const NotificationBell = () => {
  const { user } = useAuthStore();
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

  // 3. Đánh dấu đã đọc
  const handleRead = async (id: string) => {
    // Optimistic Update qua store
    markAsReadInStore(id);

    await safeRpc("mark_notification_read", { p_noti_id: id }, { silent: true });
  };

  // UI Danh sách
  const content = (
    <div style={{ width: 350, maxHeight: 400, overflowY: "auto" }}>
      <List
        dataSource={notifications}
        locale={{ emptyText: <Empty description="Không có thông báo mới" /> }}
        renderItem={(item) => (
          <List.Item
            style={{
              background: item.is_read ? "white" : "#e6f7ff",
              cursor: "pointer",
              padding: "8px 12px",
            }}
            onClick={() => handleRead(item.id)}
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
                <Typography.Text strong={!item.is_read}>
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
        )}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      title="Thông báo"
      trigger="click"
      placement="bottomRight"
    >
      <Button type="text" shape="circle">
        <Badge count={unreadCount} overflowCount={99} size="small">
          <BellOutlined style={{ fontSize: 20 }} />
        </Badge>
      </Button>
    </Popover>
  );
};
