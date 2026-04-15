import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Types
// =============================================================================

interface PubSubPushPayload {
  message: {
    data: string; // base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailPushData {
  emailAddress: string;
  historyId: string;
}

interface GmailHistoryRecord {
  id: string;
  messagesAdded?: Array<{
    message: { id: string; threadId: string };
  }>;
}

interface GmailHistoryResponse {
  history?: GmailHistoryRecord[];
  historyId: string;
  nextPageToken?: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body: { data?: string; size: number };
    parts?: GmailMessagePart[];
  };
}

interface ParsedTimoPayment {
  amount: number;
  memo: string;
  transId: string;
}

interface RenewWatchRequest {
  action: "renew-watch";
}

// =============================================================================
// [A] OAuth2 Token Management
// =============================================================================

const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID") || "";
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET") || "";
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN") || "";
const GMAIL_PUSH_SECRET = Deno.env.get("GMAIL_PUSH_SECRET") || "";
const PUBSUB_TOPIC = Deno.env.get("PUBSUB_TOPIC") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getGmailAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Gmail OAuth2 credentials chua cau hinh (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: GMAIL_REFRESH_TOKEN,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail OAuth2 token error (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Gmail OAuth2 response thieu access_token");
  }

  cachedAccessToken = json.access_token as string;
  // Refresh 5 phut truoc khi het han
  tokenExpiresAt = Date.now() + ((json.expires_in as number) - 300) * 1000;
  return cachedAccessToken;
}

// =============================================================================
// [B] Gmail API Helpers
// =============================================================================

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailHistoryList(
  accessToken: string,
  startHistoryId: string,
): Promise<GmailHistoryResponse> {
  const url = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    const err = new Error("historyId stale (404)");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail history.list error (${res.status}): ${body}`);
  }

  return await res.json() as GmailHistoryResponse;
}

async function gmailMessageGet(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail messages.get error (${res.status}): ${body}`);
  }

  return await res.json() as GmailMessage;
}

async function gmailWatch(accessToken: string, topicName: string) {
  const url = `${GMAIL_API_BASE}/watch`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail watch error (${res.status}): ${body}`);
  }

  return await res.json() as { historyId: string; expiration: string };
}

// =============================================================================
// [C] Email Body Extraction
// =============================================================================

/** base64url -> UTF-8 string */
function decodeBase64Url(data: string): string {
  // base64url: replace - -> +, _ -> /, pad with =
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  // Decode UTF-8 bytes
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

/** Traverse MIME parts, tra ve plain text body */
function extractEmailBody(message: GmailMessage): string {
  // Thu lay text/plain truoc
  const plainText = findPartByMime(message.payload, "text/plain");
  if (plainText) return plainText;

  // Fallback: text/html, strip tags
  const html = findPartByMime(message.payload, "text/html");
  if (html) return stripHtmlTags(html);

  // Last resort: top-level body
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }

  return "";
}

function findPartByMime(
  part: { mimeType: string; body: { data?: string }; parts?: GmailMessagePart[] },
  targetMime: string,
): string | null {
  if (part.mimeType === targetMime && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  if (part.parts) {
    for (const child of part.parts) {
      const result = findPartByMime(child, targetMime);
      if (result) return result;
    }
  }

  return null;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)));
}

// =============================================================================
// [D] Timo Email Parser
// =============================================================================

function parseTimoEmail(body: string, messageId: string): ParsedTimoPayment | null {
  // So tien: "tang 5.000 VND" hoac "tang 50.000 VND"
  const amountMatch = body.match(/tăng\s+([\d.]+)\s*VND/i)
    || body.match(/tang\s+([\d.]+)\s*VND/i); // fallback khong dau
  if (!amountMatch) return null;

  // Xoa dau cham phan cach ngan
  const amount = parseInt(amountMatch[1].replace(/\./g, ""), 10);
  if (isNaN(amount) || amount <= 0) return null;

  // Ma don hang: SO2603201556, POS-xxx, hoac cac pattern tuong tu
  const memoMatch = body.match(/(SO[\-\s]?\w{6,}|POS[\-\s]?[\w\-]+)/i);
  const memo = memoMatch ? memoMatch[1].toUpperCase().replace(/\s/g, "") : "";

  // Ma giao dich ngan hang: FT26079200907740
  const transIdMatch = body.match(/(FT\w+)/i);
  const transId = transIdMatch ? transIdMatch[1] : `PUSH-${messageId}`;

  // Phai co it nhat memo HOAC transId de xu ly
  if (!memo && !transIdMatch) return null;

  return { amount, memo: memo || transId, transId };
}

// =============================================================================
// [E] System Settings Helpers
// =============================================================================

function getSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function getSystemSetting(supabase: SupabaseClient, key: string): Promise<string> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return "0";
  // value la jsonb, co the la string wrapped in quotes
  const val = data.value;
  return typeof val === "string" ? val : JSON.stringify(val);
}

async function setSystemSetting(supabase: SupabaseClient, key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    console.error(`Loi update system_settings[${key}]:`, error.message);
  }
}

// =============================================================================
// [F] Main Handler
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    // =========================================================================
    // Route 0: debug env (temp — xoa sau khi fix)
    // =========================================================================
    if ((body as Record<string, string>).action === "debug-env") {
      return jsonResponse({
        has_client_id: !!GMAIL_CLIENT_ID,
        has_client_secret: !!GMAIL_CLIENT_SECRET,
        has_refresh_token: !!GMAIL_REFRESH_TOKEN,
        has_push_secret: !!GMAIL_PUSH_SECRET,
        has_pubsub_topic: !!PUBSUB_TOPIC,
        client_id_prefix: GMAIL_CLIENT_ID?.slice(0, 8) || "EMPTY",
        supabase_url_prefix: SUPABASE_URL?.slice(0, 20) || "EMPTY",
      });
    }

    // =========================================================================
    // Route 1: renew-watch (goi boi App Scripts cron moi 6 ngay)
    // =========================================================================
    if ((body as RenewWatchRequest).action === "renew-watch") {
      // Auth: accept x-gmail-push-secret header OR service_role Bearer token
      const secret = req.headers.get("x-gmail-push-secret");
      const authHeader = req.headers.get("Authorization") || "";
      const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
      if (secret !== GMAIL_PUSH_SECRET && !isServiceRole) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const accessToken = await getGmailAccessToken();
      const watchResult = await gmailWatch(accessToken, PUBSUB_TOPIC);

      const supabase = getSupabaseClient();
      await setSystemSetting(supabase, "gmail_push_watch_expiry", watchResult.expiration);

      // Neu chua co historyId (lan dau), seed luon
      const currentHistoryId = await getSystemSetting(supabase, "gmail_push_last_history_id");
      if (currentHistoryId === "0") {
        await setSystemSetting(supabase, "gmail_push_last_history_id", watchResult.historyId);
      }

      console.log(`[renew-watch] OK. Expiry: ${watchResult.expiration}, historyId: ${watchResult.historyId}`);
      return jsonResponse({
        status: "watch_renewed",
        expiration: watchResult.expiration,
        historyId: watchResult.historyId,
      });
    }

    // =========================================================================
    // Route 2: Pub/Sub push notification
    // =========================================================================
    const pubsubPayload = body as PubSubPushPayload;
    if (!pubsubPayload.message?.data) {
      return jsonResponse({ error: "Invalid Pub/Sub payload" }, 400);
    }

    // Decode Pub/Sub data
    const rawData = decodeBase64Url(pubsubPayload.message.data);
    const pushData: GmailPushData = JSON.parse(rawData);
    console.log(`[push] Email: ${pushData.emailAddress}, historyId: ${pushData.historyId}`);

    // Xac thuc: chi chap nhan push tu dung email da dang ky
    const expectedEmail = Deno.env.get("GMAIL_USER_EMAIL") || "";
    if (expectedEmail && pushData.emailAddress !== expectedEmail) {
      console.warn(`[push] Rejected: email mismatch. Expected ${expectedEmail}, got ${pushData.emailAddress}`);
      return jsonResponse({ error: "Unauthorized email" }, 403);
    }

    const supabase = getSupabaseClient();
    const lastHistoryId = await getSystemSetting(supabase, "gmail_push_last_history_id");

    // Lan dau: chi luu historyId, khong xu ly
    if (lastHistoryId === "0") {
      await setSystemSetting(supabase, "gmail_push_last_history_id", pushData.historyId);
      console.log("[push] Initialized historyId:", pushData.historyId);
      return jsonResponse({ status: "initialized" });
    }

    // Lay access token
    const accessToken = await getGmailAccessToken();

    // Fetch history tu lastHistoryId
    let history: GmailHistoryResponse;
    try {
      history = await gmailHistoryList(accessToken, lastHistoryId);
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { status?: number }).status === 404) {
        // historyId qua cu -> reset
        await setSystemSetting(supabase, "gmail_push_last_history_id", pushData.historyId);
        console.warn("[push] historyId stale, reset to:", pushData.historyId);
        return jsonResponse({ status: "historyId_reset" });
      }
      throw err;
    }

    // Xu ly tung message moi
    let processedCount = 0;
    let skippedCount = 0;

    for (const record of history.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        const msgId = added.message.id;

        try {
          const message = await gmailMessageGet(accessToken, msgId);

          // Filter: chi xu ly email tu support@timo.vn
          const fromHeader = message.payload.headers.find(
            (h) => h.name.toLowerCase() === "from",
          );
          if (!fromHeader?.value?.includes("support@timo.vn")) {
            skippedCount++;
            continue;
          }

          // Parse email body
          const emailBody = extractEmailBody(message);
          const parsed = parseTimoEmail(emailBody, msgId);
          if (!parsed) {
            console.warn(`[push] Khong parse duoc email Timo: ${msgId}`);
            skippedCount++;
            continue;
          }

          // Goi RPC co san (reuse 100%)
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "process_incoming_bank_transfer",
            {
              p_amount: parsed.amount,
              p_memo: parsed.memo,
              p_bank_ref_id: parsed.transId,
            },
          );

          if (rpcError) {
            console.error(`[push] RPC error cho msg ${msgId}:`, rpcError.message);
          } else {
            console.log(`[push] Processed ${msgId}:`, JSON.stringify(rpcResult));
            processedCount++;
          }
        } catch (msgErr) {
          console.error(`[push] Error xu ly message ${msgId}:`, msgErr);
        }
      }
    }

    // Luon update historyId (ke ca khi co loi xu ly tung message)
    await setSystemSetting(supabase, "gmail_push_last_history_id", pushData.historyId);

    console.log(`[push] Done. Processed: ${processedCount}, Skipped: ${skippedCount}`);
    return jsonResponse({ status: "ok", processed: processedCount, skipped: skippedCount });

  } catch (err) {
    console.error("[gmail-push-receiver] Fatal error:", err);
    // Return 200 cho loi permanent de tranh Pub/Sub retry storm
    // Chi return 5xx cho loi transient (network, token refresh)
    const isTransient = err instanceof TypeError // network error
      || (err instanceof Error && err.message.includes("token error"));
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      isTransient ? 500 : 200,
    );
  }
});

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
