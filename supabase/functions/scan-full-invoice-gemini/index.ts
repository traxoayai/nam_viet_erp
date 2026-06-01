import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// Rate-limit per-user dùng llm_request_log (provider='gemini') — chống cost-attack
// (Gemini free-tier 1500 req/day; 1 user buggy/malicious có thể đốt sạch quota
// trong vài giây làm cả ERP scan-invoice chết theo). Flow phiếu xuất NCC scan ít
// hơn invoice nên có env riêng SCAN_PO_RATE_LIMIT; fallback SCAN_RATE_LIMIT để
// tái dùng config chung khi chưa override.
const RATE_LIMIT = Number(
  Deno.env.get("SCAN_PO_RATE_LIMIT") ?? Deno.env.get("SCAN_RATE_LIMIT") ?? "30"
);
const RATE_WINDOW_SEC = Number(
  Deno.env.get("SCAN_PO_RATE_WINDOW_SEC") ??
    Deno.env.get("SCAN_RATE_WINDOW_SEC") ??
    "600"
);

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString();
  const { count, error } = await supabase
    .from("llm_request_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "gemini")
    .gte("created_at", since);
  if (error) {
    // Fail-open nhẹ: log warn, không chặn vì lỗi đếm (tránh self-DoS khi DB lag)
    console.warn("[rate-limit] count failed (allow request):", error.message);
    return true;
  }
  return (count ?? 0) < RATE_LIMIT;
}

// Helper: log mỗi attempt vào llm_request_log để track cost/quota (memory rule
// project_llm_free_tier_models — luôn check llm_request_log khi user kêu scan
// fail; trước fix này function chỉ console.log nên debug là mò trong bóng tối).
interface LlmLogPayload {
  provider: string;
  model: string;
  status: string;
  latency_ms?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  attempted_providers?: string[] | null;
  user_id?: string | null;
  error_message?: string | null;
}

async function logLlmAttempt(
  supabase: SupabaseClient,
  payload: LlmLogPayload
): Promise<void> {
  try {
    await supabase.from("llm_request_log").insert(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[llm_request_log] insert failed (non-fatal):", msg);
  }
}

// CORS allowlist — chỉ chấp nhận origin Portal/ERP đã đăng ký (env ALLOWED_ORIGINS,
// CSV). Trả "" khi origin lạ để browser tự block. Pattern giống scan-invoice-gemini.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);
function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.length === 0) return origin; // Dev fallback khi env chưa set
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}
function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// Error mở rộng để propagate provider status (429 = rate_limit) qua fallback chain
// — client phân biệt được "Gemini bị quá tải" vs "lỗi parse" mà không phải đoán.
interface GeminiCallError extends Error {
  status?: "rate_limit" | "error";
  providerStatus?: number;
  latencyMs?: number;
}

// Gọi Gemini với 1 model cụ thể — tách function để fallback chain dễ retry.
// Mirror pattern của sibling scan-invoice-gemini để giữ consistency cross-function.
async function callGemini(
  model: string,
  geminiApiKey: string,
  prompt: string,
  base64Data: string,
  mimeType: string
): Promise<{ data: unknown; latencyMs: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
  const started = Date.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data?.error?.message ?? `HTTP ${resp.status}`;
    const err: GeminiCallError = new Error(`Gemini ${model} fail: ${errMsg}`);
    err.status = resp.status === 429 ? "rate_limit" : "error";
    err.providerStatus = resp.status;
    err.latencyMs = latencyMs;
    throw err;
  }
  return { data, latencyMs };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  // === SECURITY: Verify caller JWT TRƯỚC mọi xử lý ===
  // Endpoint dùng GEMINI_API_KEY (cost-bearing) nên BẮT BUỘC kiểm danh tính
  // caller, nếu không bất kỳ ai trên internet đều có thể drain Gemini quota.
  // Block này đặt TRƯỚC mọi fetch file/Gemini để không tốn bandwidth/token cho
  // request lậu (giống pattern sibling scan-invoice-gemini).
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Server misconfigured: Missing Supabase credentials",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Missing Authorization header",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
  const {
    data: { user: caller },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !caller) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Invalid token",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Per-user rate-limit (chống cost-attack Gemini quota free-tier 1500 req/day).
  // Đặt SAU auth để tránh user lạ tốn DB query, TRƯỚC fetch file/Gemini để cắt
  // mọi cost-bearing call.
  const allowed = await checkRateLimit(supabase, caller.id);
  if (!allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Quá nhiều request scan trong ${Math.round(
          RATE_WINDOW_SEC / 60
        )} phút. Vui lòng thử lại sau.`,
        status: "rate_limit",
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    const rawBody = await req.text();
    if (!rawBody) throw new Error("Empty Request Body");

    let body;
    try {
      body = JSON.parse(rawBody);
      if (typeof body === "string") body = JSON.parse(body);
    } catch {
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

    // Model config qua env var — rollback không cần redeploy. Pin snapshot cụ thể
    // (gemini-2.5-flash-002) thay vì alias rolling "gemini-2.5-flash" để chống
    // silent break khi Google xoay underlying version. Fallback xuống 2.0-flash
    // khi primary fail/quota/overload. Dùng env riêng (..._PO) để không đụng
    // setting của sibling scan-invoice-gemini.
    const primaryModel =
      Deno.env.get("GEMINI_MODEL_PO") ?? "gemini-2.5-flash-002";
    const fallbackModel =
      Deno.env.get("GEMINI_MODEL_PO_FALLBACK") ?? "gemini-2.0-flash";

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

    console.log(
      `[Gemini Full PO Invoice] Scanning with primary=${primaryModel}...`
    );

    // Fallback chain: thử primary → catch → retry fallback. Gemini 2.5-flash hay
    // gặp 429 (rate-limit) & 503 (overload) chính là nguyên nhân "thỉnh thoảng
    // báo lỗi" PM kêu — nên fail-soft sang 2.0-flash thay vì throw thẳng.
    // Mỗi attempt log riêng vào llm_request_log (cả success & fail) để track
    // cost spike và phân biệt fail vì model nào — debug từ DB, không từ console.
    // Shape Gemini API response (đủ cho usage tracking & parse text part).
    interface GeminiResponse {
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    }
    const attempted: string[] = [];
    // Khởi tạo {} để TS biết definite-assigned; success path luôn ghi đè, fail
    // path luôn throw nên unused {} không bị parse.
    let aiData: GeminiResponse = {};
    let usedModel = primaryModel;
    try {
      const r = await callGemini(
        primaryModel,
        geminiApiKey,
        prompt,
        base64Data,
        mime_type ?? "image/jpeg"
      );
      aiData = r.data;
      attempted.push(primaryModel);
      const usage = aiData?.usageMetadata ?? {};
      await logLlmAttempt(supabase, {
        provider: "gemini",
        model: primaryModel,
        status: "success",
        latency_ms: r.latencyMs,
        tokens_in: usage.promptTokenCount ?? null,
        tokens_out: usage.candidatesTokenCount ?? null,
        attempted_providers: [primaryModel],
        user_id: caller.id ?? null,
      });
    } catch (primaryErrUnknown) {
      const primaryErr = primaryErrUnknown as GeminiCallError;
      attempted.push(primaryModel);
      console.warn(
        `[Gemini Full PO] Primary ${primaryModel} fail (status=${primaryErr.status ?? "error"}, http=${primaryErr.providerStatus ?? "?"}), fallback ${fallbackModel}:`,
        primaryErr.message
      );
      await logLlmAttempt(supabase, {
        provider: "gemini",
        model: primaryModel,
        status: primaryErr.status ?? "error",
        latency_ms: primaryErr.latencyMs ?? null,
        error_message: primaryErr.message,
        attempted_providers: [primaryModel],
        user_id: caller.id ?? null,
      });
      // Nếu primary === fallback (env override trùng) thì không retry tránh loop
      if (primaryModel === fallbackModel) throw primaryErr;
      const r = await callGemini(
        fallbackModel,
        geminiApiKey,
        prompt,
        base64Data,
        mime_type ?? "image/jpeg"
      );
      aiData = r.data;
      usedModel = fallbackModel;
      attempted.push(fallbackModel);
      const usage = aiData?.usageMetadata ?? {};
      await logLlmAttempt(supabase, {
        provider: "gemini",
        model: fallbackModel,
        status: "success",
        latency_ms: r.latencyMs,
        tokens_in: usage.promptTokenCount ?? null,
        tokens_out: usage.candidatesTokenCount ?? null,
        attempted_providers: attempted,
        user_id: caller.id ?? null,
      });
    }

    // Parse Result — 2.5-flash có thể trả thêm `thinking` parts; lọc đúng text part
    const parts = aiData.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find(
      (p: { text?: string }) =>
        typeof p?.text === "string" && p.text.trim().length > 0
    );
    const rawText = textPart?.text ?? "{}";
    const parsedData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    console.log(
      `[Gemini Full PO] Parsed via ${usedModel} (attempts=${attempted.join("→")})`
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (errorUnknown) {
    const error = errorUnknown as GeminiCallError;
    console.error("Fatal:", error.message);
    // Phân biệt rate-limit (429) để client biết là Gemini quá tải / quota hết,
    // không phải lỗi parse — UI có thể prompt user retry sau vài giây.
    const isRateLimit = error.status === "rate_limit";
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        status: isRateLimit ? "rate_limit" : "error",
      }),
      {
        status: isRateLimit ? 429 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
