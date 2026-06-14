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
    } catch (_e) {
      throw new Error("Invalid JSON");
    }

    const { file_url, mime_type, base64_data, expected_items } = body;
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

    // Prompt chuyên biệt để bóc tách Số Lô và Hạn sử dụng cho phiếu mua hàng
    const prompt = `
      Bạn là hệ thống trích xuất thông tin hàng hóa thông minh. Nhiệm vụ của bạn là đọc phiếu xuất kho hoặc hóa đơn này, trích xuất danh sách các sản phẩm cùng với Số Lô (Lot Number) và Hạn sử dụng (Expiry Date) của chúng.
      Trích xuất dữ liệu JSON (tuyệt đối không markdown).

      DANH SÁCH SẢN PHẨM DỰ KIẾN TRONG HỆ THỐNG:
      ${expected_items ? JSON.stringify(expected_items) : "Không có dữ liệu"}
      
      🚨 NHIỆM VỤ ĐỐI CHIẾU SẢN PHẨM:
      - Tên sản phẩm trên hóa đơn có thể viết tắt hoặc khác so với tên trong hệ thống.
      - Bạn phải đối chiếu ngữ nghĩa (Semantic Matching) tên sản phẩm trích xuất được từ hóa đơn với "Danh sách sản phẩm dự kiến" được cung cấp ở trên.
      - Nếu tìm thấy sản phẩm khớp, hãy trả về \`product_id\` tương ứng của sản phẩm đó.
      - Nếu không thể tìm thấy sản phẩm nào phù hợp trong danh sách, hãy trả về \`product_id\` là null.
      
      🚨 QUY TẮC NGÀY THÁNG BẮT BUỘC (CRITICAL):
      - Mọi thông tin Hạn sử dụng (expiry_date) PHẢI được chuyển đổi sang định dạng: "DD/MM/YYYY".
      - Ví dụ: Thấy "30/11/2026", "30.11.26" -> Trả về "30/11/2026". 
      - Các thông tin gửi cho bạn có thể luôn luôn là định dạng dd mm yyyy, nên bạn phải biết đâu là "dd"; đâu là "mm"; đâu là "yyyy". Ví dụ: thông tin 07.06.2030 thì có nghĩa là ngày 07 tháng 06 năm 2030 -> trả về "07/06/2030".
      - Nếu chỉ có tháng/năm (11/2026) -> Lấy ngày cuối tháng "30/11/2026".
      - Nếu không tìm thấy ngày -> Trả về chuỗi rỗng "".
      - Số lô (lot_number) nếu không có thì trả về chuỗi rỗng "".

      Output JSON format BẮT BUỘC:
      {
        "items": [
           { 
             "product_id": 1234,
             "name_on_invoice": "Tên sản phẩm in trên hóa đơn", 
             "lot_number": "Số lô", 
             "expiry_date": "DD/MM/YYYY",
             "quantity": 10
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
  } catch (error: unknown) {
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
