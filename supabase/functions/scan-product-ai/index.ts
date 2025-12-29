// src/supabase/functions/scan-product-ai/index.ts
// Setup: Deno server
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy File từ Request
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const mimeType = file?.type;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Chuẩn bị gửi sang Gemini
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '');
    // Dùng model Pro để suy luận logic đơn vị tốt hơn, hoặc Flash cho tốc độ
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

    // 4. Prompt (Đã được Sếp duyệt - Điểm 10)
    const prompt = `
      SYSTEM INSTRUCTION:
      ROLE & PERSONA: Bạn là một Dược sĩ Cấp cao với 20 năm kinh nghiệm quản lý kho vận, đồng thời là một Chuyên gia Content Marketing trong ngành dược phẩm.
      
      OBJECTIVE: Tôi sẽ cung cấp cho bạn hình ảnh/file PDF của một sản phẩm thuốc/TPCN. Nhiệm vụ của bạn là phân tích và trích xuất dữ liệu để phục vụ 2 mục đích cùng lúc:
      - Vận hành (Operations): Số liệu phải chính xác tuyệt đối để nhập kho ERP. Đặc biệt chú trọng việc suy luận hệ thống quy đổi đơn vị (Base/Retail/Wholesale).
      - Kinh doanh (Sales & SEO): Viết nội dung bán hàng hấp dẫn, chuẩn SEO để đăng lên Website.
      
      CRITICAL RULES:
      1. Suy luận Đơn vị:
      Nếu bao bì ghi "Hộp 10 vỉ x 10 viên":
        - Base Unit = "Viên" (Rate 1).
        - Retail Unit = "Vỉ" (Rate 10).
        - Wholesale Unit = "Hộp" (Rate 100).
        - Nếu thiếu thông tin, hãy dùng kiến thức y dược phổ quát tại Việt Nam để ước lượng (nhưng phải đánh dấu cảnh báo).
      2. Content Marketing: Viết HTML tags (h3, p, ul, li), giọng văn chuyên gia, chuẩn SEO.
      - Không copy y nguyên tờ hướng dẫn sử dụng (nhàm chán).
      - Hãy viết lại với giọng văn: Tin cậy, Chuyên gia, Thấu hiểu nỗi đau người bệnh.
      - Sử dụng HTML tags (<h3>, <p>, <ul>, <li>, <b>) để trình bày đẹp mắt. KHÔNG dùng thẻ <html>, <head>, <body>.
      
      3. Chuẩn SEO:
      - seo_title: Tên thuốc + Công dụng chính + [Chính hãng].
      - seo_description: Dưới 160 ký tự, chứa từ khóa chính, kêu gọi hành động (CTA).
      
      4. Output: Trả về kết quả DUY NHẤT là một JSON Object (JSON ONLY). No markdown block.

      OUTPUT FORMAT (Strict JSON Schema):
      {
        "product_name": "string",
        "registration_number": "string",
        "barcode": "string",
        "category_name": "string",
        "manufacturer_name": "string",
        "active_ingredients": [{ "name": "string", "amount": "string" }],
        "packing_spec": "string",
        "usage_instructions": { "0_2": "string", "2_6": "string", "6_18": "string", "18_plus": "string", "contraindication": "string" },
        "units": [
          { "unit_name": "string", "unit_type": "base|retail|wholesale|logistics", "conversion_rate": number, "is_base": boolean, "price": number }
        ],
        "marketing_content": {
          "short_description": "string",
          "full_description_html": "string",
          "seo_title": "string",
          "seo_description": "string",
          "seo_keywords": ["string"]
        }
      }
    `;

    // 5. Gọi Gemini
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: mimeType } },
    ]);

    const responseText = result.response.text();

    // 6. Clean JSON (Đề phòng AI trả về ```json ... ```)
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonData = JSON.parse(cleanedText);

    // 7. Trả về kết quả cho Frontend
    return new Response(JSON.stringify(jsonData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});