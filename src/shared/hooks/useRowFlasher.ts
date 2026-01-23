import { useState, useCallback } from 'react';

/**
 * Hook để tạo hiệu ứng flash row trong bảng
 * @returns { highlightedKey, flash }
 */
export const useRowFlasher = () => {
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const flash = useCallback((key: string | number) => {
    setHighlightedKey(String(key));
    // Reset sau 2 giây (đủ thời gian animation chạy)
    setTimeout(() => {
      setHighlightedKey(null);
    }, 2000);
  }, []);

  return { highlightedKey, flash };
};
