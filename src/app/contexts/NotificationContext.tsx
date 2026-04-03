// src/app/contexts/NotificationContext.tsx
import { notification } from "antd";
import React, { createContext, useCallback, useEffect, useRef } from "react";

import {
  useNotificationStore,
  AppNotification,
} from "@/features/settings/stores/useNotificationStore";
import { supabase } from "@/shared/lib/supabaseClient"; // Đảm bảo đường dẫn đúng alias @

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

  const handleNewNotification = useCallback(
    (payload: AppNotification) => {
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
    },
    [addNotification]
  );

  // Dùng ref để luôn có handleNewNotification mới nhất trong subscription
  const handleRef = useRef(handleNewNotification);
  handleRef.current = handleNewNotification;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeToNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
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
            const newNoti = payload.new as AppNotification;
            handleRef.current(newNoti);
          }
        )
        .subscribe();
    };

    subscribeToNotifications();

    // Cleanup đúng cách: channel được khai báo ngoài async IIFE
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};
