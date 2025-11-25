import { create } from "zustand";

// Cập nhật Interface khớp với bảng 'public.notifications' của CORE
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error"; // <-- MỚI: Khớp với SQL
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (notifications: AppNotification[]) => void;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (data) =>
    set({
      notifications: data,
      unreadCount: data.filter((n) => !n.is_read).length,
    }),

  addNotification: (newItem) =>
    set((state) => ({
      notifications: [newItem, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),

  markAsRead: (id) =>
    set((state) => {
      const newNotis = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );
      return {
        notifications: newNotis,
        unreadCount: newNotis.filter((n) => !n.is_read).length,
      };
    }),
}));
