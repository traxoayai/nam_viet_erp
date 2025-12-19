// src/hooks/useCameraScan.ts
import { App } from "antd";
import { useState } from "react";

import { inventoryService } from "@/features/inventory/api/inventoryService";

export const useCameraScan = () => {
  const { message } = App.useApp();
  const [scanning, setScanning] = useState(false);

  const scanLabel = async (file: File) => {
    setScanning(true);
    try {
      const result = await inventoryService.scanProductLabel(file);
      message.success("AI đã đọc xong vỏ hộp!");
      return result; // { lot_number, expiry_date, file_url }
    } catch (error: any) {
      message.error("Lỗi đọc ảnh: " + error.message);
      return null;
    } finally {
      setScanning(false);
    }
  };

  return { scanning, scanLabel };
};
