import { create } from "zustand";

// Cập nhật Interface khớp với bảng 'public.notifications' của CORE
export type NotificationCategory =
  | "expense_approval"
  | "purchase_order"
  | "payment_received"
  | "portal_order"
  | "portal_registration"
  | "task_update"
  | "sales_payment";

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
  reference_id?: string | null;
  category?: NotificationCategory | null;
  metadata?: Record<string, unknown> | null;
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
