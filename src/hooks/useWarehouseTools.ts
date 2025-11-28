import { App } from "antd";
//import dayjs from "dayjs";
import { useState, useEffect } from "react";

import { inventoryService } from "@/services/inventoryService";

export const useWarehouseTools = (onBarcodeScanned: (code: string) => void) => {
  const { message } = App.useApp();
  const [scanning, setScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // --- 1. BARCODE LISTENER (Lắng nghe máy quét) ---
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      // Máy quét nhập rất nhanh (< 50ms giữa các phím)
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = ""; // Reset nếu gõ phím thủ công chậm
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 3) {
          // Độ dài tối thiểu
          onBarcodeScanned(barcodeBuffer);
          barcodeBuffer = "";
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBarcodeScanned]);

  // --- 2. VOICE INPUT ---
  const startVoiceInput = (onResult: (text: string) => void) => {
    if (!("webkitSpeechRecognition" in window)) {
      return message.warning(
        "Trình duyệt không hỗ trợ giọng nói (Thử Chrome/Edge)."
      );
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      message.info(`Nghe được: "${transcript}"`);
      onResult(transcript);
    };

    recognition.start();
  };

  // --- 3. CAMERA AI SCAN (LABEL) ---
  const scanLabel = async (file: File) => {
    setScanning(true);
    try {
      const result = await inventoryService.scanProductLabel(file);
      // result trả về: { lot_number: "...", expiry_date: "YYYY-MM-DD", file_url: "..." }

      if (!result.lot_number && !result.expiry_date) {
        message.warning("AI không tìm thấy Số Lô/Hạn dùng trên ảnh này.");
      } else {
        message.success(
          `Đã đọc: Lô ${result.lot_number} - Hạn ${result.expiry_date}`
        );
      }
      return result;
    } catch (error: any) {
      message.error("Lỗi đọc ảnh: " + error.message);
      return null;
    } finally {
      setScanning(false);
    }
  };

  return {
    scanning,
    isListening,
    startVoiceInput,
    scanLabel,
  };
};
