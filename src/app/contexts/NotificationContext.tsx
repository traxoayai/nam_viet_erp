// src/app/contexts/NotificationContext.tsx
import { notification } from "antd";
import React, { createContext, useEffect, useRef } from "react";

import { supabase } from "@/shared/lib/supabaseClient"; // Đảm bảo đường dẫn đúng alias @
import {
  useNotificationStore,
  AppNotification,
} from "@/features/settings/stores/useNotificationStore";

export const NotificationContext = createContext({});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Sếp nhớ tạo file này trong public/sounds/ nhé
    audioRef.current = new Audio("/sounds/notification.mp3");

    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const handleNewNotification = (payload: AppNotification) => {
    // 1. Cập nhật Store
    addNotification(payload);

    // 2. Phát âm thanh
    if (audioRef.current) {
      audioRef.current
        .play()
        .catch((e) => console.log("Audio autoplay blocked:", e));
    }

    // 3. Hiển thị Toast (Ant Design) - Tự động chọn icon dựa trên type
    // type: 'info' | 'success' | 'warning' | 'error'
    const type = payload.type || "info";
    notification[type]({
      message: payload.title,
      description: payload.message,
      placement: "topRight",
      duration: 4,
    });

    // 4. Desktop Notification
    if (
      document.visibilityState === "hidden" &&
      Notification.permission === "granted"
    ) {
      new Notification(payload.title, {
        body: payload.message,
        icon: "/vite.svg",
      });
    }
  };

  useEffect(() => {
    const subscribeToNotifications = async () => {
      // Logic lấy User hiện tại vẫn dùng auth.getUser() là chuẩn xác nhất
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("realtime-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Ép kiểu dữ liệu trả về từ Realtime cho khớp với Interface
            const newNoti = payload.new as AppNotification;
            handleNewNotification(newNoti);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    subscribeToNotifications();
  }, []);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};
