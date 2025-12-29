// src/features/product/api/aiService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import type { AiExtractedData } from "../types/ai.types";

export const aiService = {
  // 1. Gửi file PDF/Ảnh lên Edge Function để quét
  async scanProduct(file: File): Promise<AiExtractedData> {
    const formData = new FormData();
    formData.append('file', file);

    console.log("📡 Đang gửi file lên Gemini AI...");
    
    // Gọi Edge Function 'scan-product-ai'
    const { data, error } = await supabase.functions.invoke('scan-product-ai', {
      body: formData,
    });

    if (error) {
      console.error("AI Scan Error:", error);
      throw new Error("Lỗi khi phân tích tài liệu. Vui lòng thử lại.");
    }
    
    return data as AiExtractedData;
  },

  // 2. Map dữ liệu AI sang format của Form sản phẩm (CamelCase)
  mapAiDataToForm(aiData: AiExtractedData) {
    return {
      productName: aiData.product_name,
      sku: aiData.barcode, // Tạm dùng barcode làm SKU nếu chưa có
      barcode: aiData.barcode,
      category: aiData.category_name,
      manufacturer: aiData.manufacturer_name,
      registrationNumber: aiData.registration_number,
      packingSpec: aiData.packing_spec,
      
      // Ghép hoạt chất thành chuỗi tags
      tags: aiData.active_ingredients?.map(i => `${i.name} (${i.amount})`).join(', '),
      
      // Marketing
      description: aiData.marketing_content?.full_description_html || "",
      
      // Units - Map sang cấu trúc Form List
      units: aiData.units?.map(u => ({
         unit_name: u.unit_name,
         unit_type: u.unit_type,
         conversion_rate: u.conversion_rate,
         price: u.price,
         barcode: u.barcode || aiData.barcode
      })) || []
    };
  }
};
