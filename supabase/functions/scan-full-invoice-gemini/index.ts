import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    const rawBody = await req.text();
    if (!rawBody) throw new Error("Empty Request Body");

    let body;
    try {
      body = JSON.parse(rawBody);
      if (typeof body === "string") body = JSON.parse(body);
    } catch (e) {
      throw new Error("Invalid JSON");
    }

    const { file_url, mime_type, base64_data } = body;
    let base64Data = base64_data;

    if (!base64Data) {
      if (!file_url) throw new Error("Missing file_url or base64_data");
      // Tải file về và chuyển thành Base64
      const fileResp = await fetch(file_url);
      if (!fileResp.ok) throw new Error("Download failed");
      const arrayBuffer = await fileResp.arrayBuffer();
      base64Data = encodeBase64(arrayBuffer);
    }

    const modelVersion = "gemini-2.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${geminiApiKey}`;

    // Prompt chuyên biệt để bóc tách toàn bộ thông tin sản phẩm
    const prompt = `
      Bạn là hệ thống trích xuất thông tin hàng hóa thông minh. Nhiệm vụ của bạn là đọc phiếu xuất kho, phiếu giao hàng hoặc hóa đơn này, trích xuất danh sách TOÀN BỘ các sản phẩm xuất hiện trên phiếu.
      Trích xuất dữ liệu JSON (tuyệt đối không markdown).
      
      🚨 NHIỆM VỤ TRÍCH XUẤT (BẮT BUỘC ĐẦY ĐỦ):
      1. Mã SKU SP (nếu có ghi trên phiếu).
      2. Tên Sản Phẩm (Ghi chính xác như trên phiếu).
      3. Đơn vị tính (VD: Hộp, Lọ, Viên...).
      4. Số lượng.
      5. Đơn giá nhập: Tính bằng "Thành tiền" chia cho "Số lượng" (nếu có chiết khấu, lấy thành tiền sau chiết khấu chia số lượng).
      6. Số Lô (Lot).
      7. Hạn Sử Dụng (Expiry Date).

      🚨 QUY TẮC NGÀY THÁNG BẮT BUỘC (CRITICAL):
      - Mọi thông tin Hạn sử dụng (expiry_date) PHẢI được chuyển đổi sang định dạng: "DD/MM/YYYY".
      - Ví dụ: Thấy "30/11/2026", "30.11.26" -> Trả về "30/11/2026". 
      - Nếu chỉ có tháng/năm (11/2026) -> Lấy ngày cuối tháng "30/11/2026".
      - Nếu không tìm thấy ngày -> Trả về chuỗi rỗng "".
      - Số lô nếu không có thì trả về chuỗi rỗng "".
      - Số lượng và Đơn giá phải là số (number). Nếu không có, để 0.

      Output JSON format BẮT BUỘC:
      {
        "items": [
           { 
             "sku": "Mã SKU",
             "name": "Tên sản phẩm", 
             "unit": "Đơn vị tính",
             "quantity": 10,
             "unit_price": 50000,
             "lot": "Số lô", 
             "expiry": "DD/MM/YYYY"
           }
        ]
      }
    `;

    console.log(`[Gemini PO Invoice] Scanning...`);

    const aiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mime_type || "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    const aiData = await aiResp.json();
    if (!aiResp.ok) throw new Error(`Gemini Error: ${aiData.error?.message}`);

    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedData = JSON.parse(rawText.replace(/```json|```/g, "").trim());

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Fatal:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
