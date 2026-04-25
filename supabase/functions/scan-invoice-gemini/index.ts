// Setup: deno install --allow-net --allow-env --allow-read index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Config & Validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    // 2. Parse Payload (Robust V9)
    const rawBody = await req.text();
    if (!rawBody) throw new Error("Empty Request Body");

    let body;
    try {
      body = JSON.parse(rawBody);
      if (typeof body === "string") body = JSON.parse(body);
    } catch {
      throw new Error("Invalid JSON");
    }

    // 3. Ping Mode
    if (body.action === "ping") {
      // ... (Giữ nguyên logic Ping nếu cần, hoặc trả về simple pong)
      return new Response(JSON.stringify({ success: true, message: "Pong" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Main Logic
    const { file_url, mime_type, mode } = body;
    if (!file_url) throw new Error("Missing file_url");
    // mode='extract_only' → chỉ scan + trả parsed_data, KHÔNG insert/update
    // finance_invoices. Dùng cho phiếu xuất kho NCC ở trang nhập kho/mua hàng
    // (mục đích chỉ auto-fill lot/expiry, không phải hóa đơn VAT).
    const extractOnly = mode === "extract_only";

    // Download & Convert
    const fileResp = await fetch(file_url);
    if (!fileResp.ok) throw new Error("Download failed");
    const arrayBuffer = await fileResp.arrayBuffer();
    const base64Data = encodeBase64(arrayBuffer);

    // Call Gemini
    const modelVersion = "gemini-2.0-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${geminiApiKey}`;

    // Prompt (V12 - Date Fixed)
    const prompt = `
      Bạn là chuyên gia OCR hóa đơn thuốc. Nhiệm vụ: Trích xuất dữ liệu JSON (tuyệt đối không markdown).
      
      🚨 QUY TẮC NGÀY THÁNG BẮT BUỘC (CRITICAL):
      - Mọi thông tin ngày tháng (invoice_date, expiry_date) PHẢI được chuyển đổi sang định dạng ISO 8601: "YYYY-MM-DD".
      - Ví dụ: Thấy "30/11/2026", "30.11.26" hay "30-Nov-2026" -> Trả về "2026-11-30". Nhưng nên nhớ, các thông tin gửi cho bạn có thể luôn luôn là định dạng dd mm yyyy, nên bạn phải biết đâu là "dd"; đâu là "mm"; đâu là "yyyy". Ví dụ: thông tin 07.06.2030 thì có nghĩa là ngày 07 tháng 06 năm 2030.
      - Nếu chỉ có tháng/năm (11/2026) -> Lấy ngày cuối tháng "2026-11-30".
      - Nếu không tìm thấy ngày -> Trả về null.

      Output JSON format:
      {
        "invoice_number": "string",
        "invoice_symbol": "string", 
        "invoice_date": "YYYY-MM-DD",
        "supplier_name": "string",
        "tax_code": "string",
        "supplier_address": "string",
        "total_amount_pre_tax": number,
        "tax_amount": number,
        "total_amount_post_tax": number,
        "items": [
           { "name": "string", "unit": "string", "quantity": number, "unit_price": number, "total_amount": number, "vat_rate": number, "lot_number": "string", "expiry_date": "YYYY-MM-DD" }
        ]
      }
    `;

    console.log(`[Gemini] Scanning...`);
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

    // Parse Result
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedInvoice = JSON.parse(
      rawText.replace(/```json|```/g, "").trim()
    );

    // ==================================================================
    // 5. EXTRACT-ONLY SHORT-CIRCUIT (cho flow nhập kho từ phiếu xuất NCC)
    // ==================================================================
    if (extractOnly) {
      console.log(`[ExtractOnly] Skip DB insert, return parsed only`);
      return new Response(
        JSON.stringify({
          success: true,
          data: parsedInvoice,
          action: "EXTRACT_ONLY",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================================================================
    // 6. DEDUPLICATION LOGIC (CHỐNG TRÙNG LẶP) - THEO YÊU CẦU AURA
    // ==================================================================
    const supabase = createClient(supabaseUrl, supabaseKey);
    let targetId;
    let actionType = "INSERT";

    // Chỉ check trùng nếu AI đọc được Số hóa đơn (Nếu AI ko đọc được thì đành tạo mới)
    if (parsedInvoice.invoice_number) {
      // Query check tồn tại (Dựa trên Số hóa đơn + MST Nhà cung cấp)
      // Lưu ý: Nếu MST AI đọc null thì chỉ check Số hóa đơn (rủi ro thấp nhưng chấp nhận được)
      let query = supabase
        .from("finance_invoices")
        .select("id, status, invoice_number")
        .eq("invoice_number", parsedInvoice.invoice_number);

      if (parsedInvoice.tax_code) {
        query = query.eq("supplier_tax_code", parsedInvoice.tax_code);
      }

      const { data: existingInvoices, error: searchError } = await query;

      if (!searchError && existingInvoices && existingInvoices.length > 0) {
        const existing = existingInvoices[0]; // Lấy bản ghi đầu tiên tìm thấy

        console.log(
          `[Deduplication] Found existing invoice ID: ${existing.id} Status: ${existing.status}`
        );

        // Case A: Đã nhập kho (Verified/Posted) -> Báo lỗi Conflict
        if (existing.status === "verified" || existing.status === "posted") {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Hóa đơn số ${existing.invoice_number} này đã được nhập kho/xử lý rồi. Không thể ghi đè.`,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Case B: Đang là nháp (Draft) -> Update đè
        if (existing.status === "draft" || existing.status === "rejected") {
          targetId = existing.id;
          actionType = "UPDATE";
        }
      }
    }

    // Thực thi DB (Insert hoặc Update)
    const dbPayload = {
      invoice_number: parsedInvoice.invoice_number,
      invoice_symbol: parsedInvoice.invoice_symbol,
      invoice_date: parsedInvoice.invoice_date,
      supplier_name_raw: parsedInvoice.supplier_name,
      supplier_tax_code: parsedInvoice.tax_code,
      supplier_address_raw: parsedInvoice.supplier_address,
      total_amount_pre_tax: parsedInvoice.total_amount_pre_tax,
      tax_amount: parsedInvoice.tax_amount,
      total_amount_post_tax: parsedInvoice.total_amount_post_tax,
      items_json: parsedInvoice.items,
      parsed_data: parsedInvoice,
      file_url: file_url, // Cập nhật luôn file mới nhất user vừa up
      file_type: mime_type,
      status: "draft", // Reset về draft nếu update
      updated_at: new Date().toISOString(),
    };

    let dbResult;
    if (actionType === "UPDATE") {
      dbResult = await supabase
        .from("finance_invoices")
        .update(dbPayload)
        .eq("id", targetId)
        .select("id")
        .single();
    } else {
      dbResult = await supabase
        .from("finance_invoices")
        .insert(dbPayload)
        .select("id")
        .single();
    }

    if (dbResult.error) throw dbResult.error;

    console.log(`[Success] Action: ${actionType} - ID: ${dbResult.data.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: dbResult.data.id,
        data: parsedInvoice,
        action: actionType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Fatal:", errMsg);
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
