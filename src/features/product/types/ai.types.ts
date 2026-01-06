// src/features/product/types/ai.types.ts

// 1. Định nghĩa các đơn vị (khớp với prompt Gemini)
export type AiUnitType = 'base' | 'retail' | 'wholesale' | 'logistics';

export interface AiUnit {
  unit_name: string;
  unit_type: AiUnitType;
  conversion_rate: number;
  is_base: boolean;
  price: number;
  barcode?: string;
}

// 2. Định nghĩa nội dung Marketing/SEO
export interface AiMarketingContent {
  short_description: string;
  full_description_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
}

// 3. Định nghĩa Hướng dẫn sử dụng (Dynamic key)
export interface AiUsageInstructions {
  [key: string]: string; // Ví dụ: "0_2": "...", "adult": "..."
}

// 4. Interface CHÍNH (Dữ liệu tổng hợp từ Gemini)
export interface AiExtractedData {
  product_name: string;
  registration_number?: string;
  barcode?: string;
  category_name: string;
  manufacturer_name: string;
  active_ingredients: { name: string; amount: string }[];
  packing_spec: string;
  
  // [NEW] Hỗ trợ cấu trúc JSON cho HDSD
  usage_instructions?: AiUsageInstructions;
  
  // Units
  units: AiUnit[];
  
  // Marketing
  marketing_content?: AiMarketingContent;
}
