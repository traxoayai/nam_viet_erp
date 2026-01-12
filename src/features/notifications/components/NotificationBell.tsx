// src/features/notifications/components/NotificationBell.tsx
import { BellOutlined } from "@ant-design/icons";
import { Badge, Button, List, Popover, Typography, Empty, Avatar } from "antd";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

export const NotificationBell = () => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Tải thông báo ban đầu
  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  // 2. Lắng nghe Realtime
  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const subscription = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`, // Chỉ nhận tin của mình
        },
        (payload) => {
          // Có thông báo mới -> Đẩy vào đầu danh sách
          const newNoti = payload.new;
          setNotifications((prev) => [newNoti, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // (Tùy chọn) Phát âm thanh hoặc hiện Toast
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  // 3. Đánh dấu đã đọc
  const handleRead = async (id: string) => {
    // Optimistic Update
    setNotifications(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase.rpc('mark_notification_read', { p_noti_id: id });
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
                background: item.is_read ? 'white' : '#e6f7ff', 
                cursor: 'pointer',
                padding: '8px 12px'
            }}
            onClick={() => handleRead(item.id)}
          >
            <List.Item.Meta
              avatar={
                 <Avatar 
                    style={{ backgroundColor: item.type === 'warning' ? '#ff4d4f' : '#1890ff' }} 
                    icon={<BellOutlined />} 
                 />
              }
              title={<Typography.Text strong={!item.is_read}>{item.title}</Typography.Text>}
              description={
                <div>
                    <div>{item.message}</div>
                    <div style={{fontSize: 11, color: '#999', marginTop: 4}}>
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
