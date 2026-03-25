// src/shared/hooks/useAutoLogout.ts
import { Modal } from "antd";
import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

// Thời gian chờ: 30 phút = 1,800,000 ms (Theo yêu cầu của Sếp)
const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_TIMEOUT = 10 * 1000; // Cho 10 giây để người dùng kip phản ứng

export const useAutoLogout = () => {
  const { logout, user } = useAuthStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const forceOutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<any>(null);

  const handleLogout = useCallback(() => {
    if (warningRef.current) warningRef.current.destroy();
    logout();
    window.location.href = "/login"; 
  }, [logout]);

  const showWarning = useCallback(() => {
    warningRef.current = Modal.warning({
      title: "Hết phiên làm việc",
      content: "Hệ thống sẽ tự động đăng xuất sau 10 giây để bảo mật. Hãy di chuyển chuột hoặc bấm phím bất kỳ để hủy!",
      okText: "Đăng xuất ngay",
      onOk: handleLogout,
      keyboard: false,
      maskClosable: false,
    });

    // Đếm ngược 10s sẽ force out
    forceOutRef.current = setTimeout(handleLogout, WARNING_TIMEOUT);
  }, [handleLogout]);

  const resetTimer = useCallback(() => {
    if (!user) return;

    // 1. Nếu đang hiện Modal cảnh báo mà User cử động lại -> Hủy out, đóng Modal (Đường lui an toàn)
    if (forceOutRef.current) {
      clearTimeout(forceOutRef.current);
      forceOutRef.current = null;
      if (warningRef.current) {
        warningRef.current.destroy();
        warningRef.current = null;
      }
    }

    // 2. Reset bộ đếm 30 phút
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showWarning, IDLE_TIMEOUT);
  }, [user, showWarning]);

  useEffect(() => {
    if (!user) return;

    // ĐÃ FIX: Thay 'keypress' bằng 'keydown' để bắt được phím Numpad và Tab
    const events = ["click", "mousemove", "keydown", "scroll", "touchstart"];

    // ĐÃ FIX: Kỹ thuật Throttling (Chặn gọi liên tục). Chỉ reset Timer tối đa 1 lần mỗi 2 giây. Tránh treo RAM.
    let throttleTimer: boolean = false;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = true;
      resetTimer();
      setTimeout(() => { throttleTimer = false; }, 2000); 
    };

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetTimer(); // Kích hoạt lần đầu

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (forceOutRef.current) clearTimeout(forceOutRef.current);
    };
  }, [user, resetTimer]);
};