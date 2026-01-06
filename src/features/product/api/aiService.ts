// src/features/product/api/aiService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { AiExtractedData, AiMarketingContent } from "../types/ai.types";

// Hàm hỗ trợ: Chuyển đổi File sang Base64 string (Bỏ prefix data:...)
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Cắt bỏ phần header "data:application/pdf;base64," chỉ lấy nội dung mã hóa
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const aiService = {
  // 1. Gửi file PDF/Ảnh lên Edge Function (JSON Payload - Fix lỗi 500)
  async scanProduct(file: File): Promise<AiExtractedData> {
    console.log(`📡 Đang xử lý file: ${file.name} (${file.size} bytes)...`);

    try {
      // BƯỚC 1: Chuyển đổi file sang Base64 ngay tại Client
      const base64Content = await fileToBase64(file);

      console.log("✅ Đã chuyển đổi Base64. Đang gọi Gemini AI...");

      // BƯỚC 2: Gọi Edge Function với body là JSON
      const { data, error } = await supabase.functions.invoke('scan-product-ai', {
        body: {
          fileContent: base64Content,
          mimeType: file.type || 'application/pdf',
          fileName: file.name
        },
      });

      if (error) {
        let errorMessage = "Lỗi kết nối AI.";
        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            errorMessage = body.error || error.message;
          } catch {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
        console.error("AI Scan Error:", errorMessage);
        throw new Error(errorMessage);
      }

      return data as AiExtractedData;

    } catch (err: any) {
      console.error("Client Scan Exception:", err);
      throw new Error(err.message || "Lỗi khi xử lý tập tin.");
    }
  },

  // 2. Map dữ liệu AI sang format của Form (Full Fields)
  mapAiDataToForm(aiData: AiExtractedData) {
    const marketing = aiData.marketing_content || ({} as Partial<AiMarketingContent>);
    const usage = aiData.usage_instructions || {};

    return {
      // --- A. THÔNG TIN CƠ BẢN (Bảng products) ---
      productName: aiData.product_name,
      sku: aiData.barcode, // Tạm dùng barcode làm SKU
      barcode: aiData.barcode,
      category: aiData.category_name,
      manufacturer: aiData.manufacturer_name,
      registrationNumber: aiData.registration_number,
      packingSpec: aiData.packing_spec,
      
      // Ghép hoạt chất thành chuỗi tags
      tags: aiData.active_ingredients?.map(i => `${i.name} (${i.amount})`).join(', '),
      
      // --- B. HƯỚNG DẪN SỬ DỤNG (Bảng products - Cột usage_instructions JSONB) ---
      // [CẬP NHẬT MỚI]: Hứng dữ liệu Y Dược
      usageInstructions: {
        "0_2": usage["0_2"] || "",
        "2_6": usage["2_6"] || "",
        "6_18": usage["6_18"] || "",
        "18_plus": usage["18_plus"] || "",
        "contraindication": usage.contraindication || ""
      },

      // --- C. THÔNG TIN QUY ĐỔI (Bảng product_units) ---
      units: aiData.units?.map(u => ({
         unit_name: u.unit_name,
         unit_type: u.unit_type, // 'base' | 'retail' | 'wholesale' | 'logistics'
         conversion_rate: u.conversion_rate,
         price: u.price, 
         barcode: u.is_base ? aiData.barcode : null
      })) || [],

      // --- D. NỘI DUNG MARKETING & SEO (Bảng product_contents) ---
      content: {
        description_html: marketing.full_description_html || "", 
        short_description: marketing.short_description || "",    
        seo_title: marketing.seo_title || aiData.product_name,   
        seo_description: marketing.seo_description || "",        
        seo_keywords: marketing.seo_keywords || [],              
        channel: 'website',
        language_code: 'vi',
        is_published: true
      }
    };
  }
};