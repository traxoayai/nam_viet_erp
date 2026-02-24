// src/shared/hooks/useAutoLogout.ts
import { Modal } from "antd";
import { useEffect, useRef } from "react";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";

// Thời gian chờ: 15 phút = 900,000 ms
const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_TIMEOUT = 5 * 1000; // 5 giây đếm ngược để force logout

export const useAutoLogout = () => {
  const { logout, user } = useAuthStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<any>(null); // Giữ ref của Modal

  const handleLogout = () => {
    if (warningRef.current) warningRef.current.destroy(); // Đóng modal cũ nếu có
    logout();
    window.location.href = "/login"; // Force redirect
  };

  const showWarning = () => {
    warningRef.current = Modal.warning({
      title: "Hết phiên làm việc",
      content: "Hệ thống sẽ tự động đăng xuất sau 5 giây để bảo mật.",
      okText: "Đăng xuất ngay",
      onOk: handleLogout,
      keyboard: false,
      maskClosable: false,
    });

    // Force logout sau 5s nếu user không bấm gì
    setTimeout(handleLogout, WARNING_TIMEOUT);
  };

  const resetTimer = () => {
    if (!user) return; // Chưa login thì thôi
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showWarning, IDLE_TIMEOUT);
  };

  useEffect(() => {
    // Các sự kiện được coi là "Có hoạt động"
    const events = ["click", "mousemove", "keypress", "scroll", "touchstart"];

    const handleActivity = () => resetTimer();

    if (user) {
      events.forEach((event) => window.addEventListener(event, handleActivity));
      resetTimer(); // Bắt đầu đếm
    }

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);
};
