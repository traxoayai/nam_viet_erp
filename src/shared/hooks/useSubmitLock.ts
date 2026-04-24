// src/shared/hooks/useSubmitLock.ts
// Hook chống double-submit: wrap async handler, tự động lock/unlock.
import { useRef, useState, useCallback } from "react";

interface SubmitLock {
  isLocked: boolean;
  withLock: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

/**
 * Trả về { isLocked, withLock }.
 * - `isLocked`: true khi đang xử lý → dùng để disable button.
 * - `withLock(fn)`: set lock trước khi gọi fn, reset (kể cả khi throw) trong finally.
 */
export function useSubmitLock(): SubmitLock {
  const [isLocked, setIsLocked] = useState(false);
  // ref để guard đồng bộ (tránh stale closure với useState)
  const lockRef = useRef(false);

  const withLock = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setIsLocked(true);
      try {
        return await fn();
      } finally {
        lockRef.current = false;
        setIsLocked(false);
      }
    },
    []
  );

  return { isLocked, withLock };
}
