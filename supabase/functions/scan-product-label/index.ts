// Setup: deno install --allow-net --allow-env --allow-read index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Config Validation
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey)
      throw new Error("Server Config Error: Missing GEMINI_API_KEY");

    // 3. SMART PARSER (Robust V9 Standard)
    const rawBody = await req.text();
    let body;

    if (!rawBody) throw new Error("Request body is empty");

    try {
      body = JSON.parse(rawBody);
      if (typeof body === "string") {
        body = JSON.parse(body);
      }
    } catch (e: any) {
      throw new Error("Invalid JSON format.");
    }

    // Lấy dữ liệu
    const file_url = body.file_url || body.fileUrl;
    // Mặc định là ảnh vì chụp vỏ hộp thường là ảnh
    const mime_type = body.mime_type || body.mimeType || "image/jpeg";

    if (!file_url) throw new Error("Missing required field: 'file_url'");

    console.log(`[Label Scan] Processing: ${file_url}`);

    // 4. Download File
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok)
      throw new Error(
        `Failed to download image. Status: ${fileResponse.status}`
      );

    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64Data = encodeBase64(arrayBuffer);

    // 5. Call Gemini API (Vision Mode)
    const modelVersion = "gemini-2.0-flash"; // Vision model tối ưu
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${geminiApiKey}`;

    const prompt = `
      Bạn là chuyên gia OCR dược phẩm. Nhiệm vụ: Đọc thông tin từ ảnh chụp vỏ hộp/bao bì thuốc này.
      
      Lưu ý đặc biệt:
      - Văn bản thường in phun kim (chấm chấm) hoặc dập nổi, in đè lên hình ảnh. Hãy nhìn thật kỹ.
      - Phân biệt kỹ giữa Ngày Sản Xuất (NSX/Mfg Date) và Hạn Sử Dụng (HSD/Exp Date). Tôi chỉ cần Hạn Dùng.
      - Cụ thể, tôi cần 3 thông tin chính: Số Lô Sản Xuất; Hạn Sử Dụng; Số Serial (nếu có)
      
      Yêu cầu Output JSON (không markdown):
      {
        "lot_number": "string hoặc null (Tìm chữ Lot, Batch, Số lô)",
        "expiry_date": "YYYY-MM-DD hoặc null (Tìm chữ Exp, HSD, Date. Nếu chỉ có tháng/năm thì lấy ngày cuối tháng)",
        "serial_number": "string hoặc null (Tìm chữ S/N, Serial nếu có)"
      }
    `;

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime_type, data: base64Data } },
          ],
        },
      ],
    };

    console.log(`[Gemini] Scanning label...`);
    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("Gemini Error:", JSON.stringify(aiData));
      throw new Error(`Gemini API Error: ${aiData.error?.message}`);
    }

    // 6. Parse AI Result
    if (!aiData.candidates || !aiData.candidates[0].content) {
      throw new Error("Gemini could not read text from image.");
    }

    const rawText = aiData.candidates[0].content.parts[0].text;
    const jsonStr = rawText.replace(/```json|```/g, "").trim();

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("AI Parse Error:", rawText);
      throw new Error("AI returned invalid JSON.");
    }

    console.log(`[Success] Label Data:`, JSON.stringify(parsedData));

    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Fatal Error]:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
