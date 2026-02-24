// src/shared/ui/warehouse-tools/ScannerListener.tsx
import { Tag } from "antd";
import { Zap, ZapOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ScannerListenerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
}

export const ScannerListener = ({
  onScan,
  enabled = true,
}: ScannerListenerProps) => {
  const [isReady, setIsReady] = useState(false);
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const char = e.key;

      // 1. Logic phát hiện Scanner: Tốc độ gõ siêu nhanh (< 50ms giữa các phím)
      if (now - lastKeyTime.current > 50) {
        buffer.current = ""; // Reset nếu gõ tay bình thường
      }
      lastKeyTime.current = now;

      // 2. Xử lý ký tự
      if (char === "Enter") {
        if (buffer.current.length > 2) {
          // Barcode hợp lệ (ít nhất 3 ký tự)
          onScan(buffer.current);
          buffer.current = "";

          // Visual feedback
          setIsReady(true);
          setTimeout(() => setIsReady(false), 2000);
        }
      } else if (char.length === 1) {
        // Chỉ nhận ký tự in được (bỏ qua Shift, Ctrl...)
        buffer.current += char;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onScan]);

  // UI: Chỉ hiển thị một Badge nhỏ góc màn hình để báo hiệu
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 9999,
        opacity: 0.8,
        pointerEvents: "none", // Không che nút khác
      }}
    >
      <Tag
        color={isReady ? "success" : "default"}
        icon={
          isReady ? (
            <Zap size={14} style={{ marginRight: 4 }} />
          ) : (
            <ZapOff size={14} style={{ marginRight: 4 }} />
          )
        }
      >
        {isReady ? "SCANNER READY" : "Scanner Connected"}
      </Tag>
    </div>
  );
};
