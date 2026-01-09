// src/supabase/functions/scan-product-ai/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Nhận JSON từ Client (Thay vì FormData)
    // Client gửi: { fileContent: "base64...", mimeType: "..." }
    const { fileContent, mimeType } = await req.json();

    if (!fileContent) {
      throw new Error("Thiếu nội dung file (fileContent base64).");
    }

    console.log(`[Processing] Type: ${mimeType}, Base64 Length: ${fileContent.length}`);

    // 3. Config Gemini
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY");

    // Dùng Model 1.5 Flash hoặc 2.0 Flash (Hỗ trợ PDF/Image cực tốt và rẻ)
    const MODEL_NAME = "gemini-2.5-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    // 5. Prompt (Đã được Sếp duyệt - Điểm 10)
    const prompt = `
      SYSTEM INSTRUCTION:
      ROLE & PERSONA: Bạn là một Dược sĩ Cấp cao với 20 năm kinh nghiệm quản lý kho vận, đồng thời là một Chuyên gia Content Marketing trong ngành dược phẩm.
      
      OBJECTIVE: Tôi sẽ cung cấp cho bạn hình ảnh/file PDF của một sản phẩm thuốc/TPCN. Nhiệm vụ của bạn là phân tích và trích xuất dữ liệu để phục vụ 4 mục đích cùng lúc:
      - Vận hành (Operations): Số liệu phải chính xác tuyệt đối để nhập kho ERP. Đặc biệt chú trọng việc suy luận hệ thống quy đổi đơn vị (Base/Retail/Wholesale/logistics).
      - Kinh doanh và Marketing(Sales & SEO): Viết nội dung bán hàng hấp dẫn, chuẩn SEO để đăng lên Website.
      - Hỗ trợ kiến thức Y - Dược cho Dược Sĩ bán hàng: Viết hướng dẫn sử dụng thuốc/sản phẩm một cách ngắn gọn và dễ hiểu, làm nguồn tài liệu cho các Dược Sĩ bán hàng và tham khảo.
      Ví dụ như: "Sáng 2 viên - Tối 2 Viên - Sau ăn 10 phút"; "Sáng 1 viên - Tối 1 Viên - Trước ăn 20 phút"; Lưu ý rằng, hệ thống đang chia ra cách sử dụng sản phẩm theo độ tuổi theo 4 nhóm sau: 0-2 tuổi; 2-6 tuổi; 6-18 tuổi; từ 18 tuổi trở lên.
        - Tên sản phẩm viết ngắn gọn, và dễ hiểu. Ví dụ như: "Panadol Extra GSK"; "Miduc 100mg (Itraconazol)"; "Hoạt Huyết Dưỡng Não Traphaco (không đường)"; "Hoạt Huyết Dưỡng Não Hải Dương";
      
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
      
      4. "product_name": Tạo tên sản phẩm chuẩn theo công thức: [Tên thương mại] [Hãng sản xuất viết tắt] ([Quy cách đóng gói]). Ví dụ: "Panadol Extra GSK (15 vỉ x 12 viên)".
      5. Output: Trả về kết quả DUY NHẤT là một JSON Object (JSON ONLY). No markdown block.

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

    // 5. Gọi Gemini (Gửi thẳng Base64 nhận được từ Client)
    // KHÔNG CẦN encodeBase64 hay btoa nữa vì Client đã làm rồi
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || "application/pdf",
                data: fileContent // Base64 nguyên gốc từ Client
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Gemini Error]", errText);
      throw new Error(`Lỗi Gemini: ${response.status} - ${errText}`);
    }

    const aiData = await response.json();
    
    // 6. Parse Kết quả
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("AI không trả về kết quả.");

    // Clean Markdown
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    let jsonData;
    try {
        jsonData = JSON.parse(cleanJson);
    } catch (e) {
        throw new Error("AI trả về định dạng không đúng JSON.");
    }

    return new Response(JSON.stringify(jsonData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error: any) {
    console.error("[Function Error]:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});