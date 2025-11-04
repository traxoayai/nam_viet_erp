// src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

// Hook này sẽ "trì hoãn" việc cập nhật một giá trị
// cho đến khi người dùng ngừng gõ trong một khoảng thời gian
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Đặt hẹn giờ
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Hủy hẹn giờ nếu value thay đổi (người dùng gõ tiếp)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Chỉ chạy lại nếu value hoặc delay thay đổi

  return debouncedValue;
}
