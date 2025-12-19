// src/shared/hooks/useRowFlasher.ts
import { useState, useRef, useEffect } from 'react';

export const useRowFlasher = () => {
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const flash = (key: string | number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 1. Highlight
    setHighlightedKey(String(key));

    // 2. Scroll Row into View
    // Try to find row by data-row-key (Antd Table standard)
    const row = document.querySelector(`[data-row-key="${key}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. Remove Highlight after 2000ms
    timeoutRef.current = setTimeout(() => {
      setHighlightedKey(null);
    }, 2000);
  };

  return { highlightedKey, flash };
};
