// src/features/finance/hooks/useXmlInvoice.ts
import { useState } from "react";
import { App } from "antd";
import { parseInvoiceXML, ParsedInvoiceItem } from "../utils/xmlParser";
import { invoiceService } from "../api/invoiceService";
import { useProductStore } from "@/features/inventory/stores/productStore"; 

export interface MappedInvoiceItem extends ParsedInvoiceItem {
  internal_product_id: number | null;
  internal_unit: string | null;
  is_mapped: boolean;
  match_type: 'exact' | 'prediction' | 'none';
}

export const useXmlInvoice = () => {
  const { message, notification } = App.useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const { products } = useProductStore(); 

  // --- THUẬT TOÁN SENKO-MATCH V1 (Client Side) ---
  const findBestMatchProduct = (xmlName: string): number | null => {
    if (!products || products.length === 0) return null;
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
    const xmlTokens = normalize(xmlName);
    let bestMatchId: number | null = null;
    let maxScore = 0;

    for (const prod of products) {
      const prodNameTokens = normalize(prod.name);
      let matches = 0;
      xmlTokens.forEach(token => {
        if (prodNameTokens.includes(token)) matches++;
      });
      if (prod.sku && xmlName.includes(prod.sku)) matches += 10;
      // Ép kiểu an toàn để tránh lỗi TS nếu barcode chưa định nghĩa
      const pAny = prod as any;
      if (pAny.barcode && xmlName.includes(pAny.barcode)) matches += 10;

      if (matches > maxScore) {
        maxScore = matches;
        bestMatchId = prod.id;
      }
    }
    return maxScore >= 2 ? bestMatchId : null;
  };

  const processXmlFile = async (file: File) => {
    setIsProcessing(true);
    try {
      // 1. Upload File XML lên Storage để lấy Link (FIX LỖI NOT NULL)
      // Dùng chung hàm upload ảnh (vì bản chất là upload file)
      const fileUrl = await invoiceService.uploadInvoiceImage(file);

      // 2. Đọc nội dung
      const text = await file.text();
      const { header, items } = parseInvoiceXML(text);

      // 3. Check trùng lặp
      const isExist = await invoiceService.checkInvoiceExists(
        header.supplier_tax_code,
        header.invoice_symbol,
        header.invoice_number
      );

      if (isExist) {
        notification.error({
          message: "Cảnh báo trùng lặp!",
          description: `Hóa đơn ${header.invoice_number} đã tồn tại.`,
          duration: 5,
        });
        return null;
      }

      // 4. Mapping (FIX LỖI MAPPING)
      const mappedItems: MappedInvoiceItem[] = await Promise.all(
        items.map(async (item) => {
          // Tầng 1: Hỏi DB (Dùng unit gốc làm key)
          const dbMatch = await invoiceService.getMappedProduct(
            header.supplier_tax_code,
            item.name,
            item.unit || "" 
          );

          if (dbMatch) {
            return { 
                ...item, 
                internal_product_id: dbMatch.productId, 
                internal_unit: dbMatch.unit,
                is_mapped: true, 
                match_type: 'exact' 
            };
          }

          // Tầng 2: AI Gợi ý
          const predictedId = findBestMatchProduct(item.name);
          if (predictedId) {
             return { ...item, internal_product_id: predictedId, internal_unit: null, is_mapped: true, match_type: 'prediction' };
          }

          return { ...item, internal_product_id: null, internal_unit: null, is_mapped: false, match_type: 'none' };
        })
      );

      message.success(`Đã upload & đọc xong! Khớp ${mappedItems.filter(i => i.is_mapped).length}/${mappedItems.length} SP.`);

      return { 
          header, 
          items: mappedItems, 
          fileUrl, // <-- Trả về URL để form lưu vào DB
          fileRaw: file 
      };

    } catch (error: any) {
      console.error(error);
      message.error("Lỗi xử lý XML: " + error.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { processXmlFile, isProcessing };
};
