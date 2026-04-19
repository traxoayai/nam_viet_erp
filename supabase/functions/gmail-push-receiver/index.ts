import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";
import { GmailAccount, loadGmailAccounts } from "./accounts.ts";
import { AccountState, getAccountState, setAccountState } from "./state.ts";

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
const GMAIL_PUSH_SECRET = Deno.env.get("GMAIL_PUSH_SECRET") || "";
const PUBSUB_TOPIC = Deno.env.get("PUBSUB_TOPIC") || "";

// OIDC auth for Pub/Sub push (opt-in). Khi PUBSUB_OIDC_AUDIENCE set -> require va verify
// OIDC JWT tu Google, dam bao request den tu Pub/Sub subscription da config dung SA.
const PUBSUB_OIDC_AUDIENCE = Deno.env.get("PUBSUB_OIDC_AUDIENCE") || "";
const PUBSUB_OIDC_SERVICE_ACCOUNT = Deno.env.get("PUBSUB_OIDC_SERVICE_ACCOUNT") || "";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ACCOUNTS: GmailAccount[] = loadGmailAccounts((k) => Deno.env.get(k) || undefined);

async function verifyPubsubOidc(
  req: Request,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!PUBSUB_OIDC_AUDIENCE) return { ok: true }; // verification disabled
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, reason: "Missing Authorization header" };
  }
  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: PUBSUB_OIDC_AUDIENCE,
    });
    if (
      PUBSUB_OIDC_SERVICE_ACCOUNT &&
      (payload as { email?: string }).email !== PUBSUB_OIDC_SERVICE_ACCOUNT
    ) {
      return {
        ok: false,
        reason: `SA email mismatch: ${(payload as { email?: string }).email}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Invalid JWT" };
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

async function getGmailAccessToken(account: GmailAccount): Promise<string> {
  const cached = tokenCache.get(account.email);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    throw new Error("Gmail OAuth2 credentials chua cau hinh (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail OAuth2 token error cho ${account.email} (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Gmail OAuth2 response thieu access_token cho ${account.email}`);
  }

  const entry: CachedToken = {
    token: json.access_token as string,
    expiresAt: Date.now() + ((json.expires_in as number) - 300) * 1000,
  };
  tokenCache.set(account.email, entry);
  return entry.token;
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
    // Route 1: renew-watch (auto-renewed by pg_cron every 6 days)
    // =========================================================================
    if ((body as RenewWatchRequest).action === "renew-watch") {
      // Auth: accept x-gmail-push-secret header OR service_role Bearer token
      const secret = req.headers.get("x-gmail-push-secret");
      const authHeader = req.headers.get("Authorization") || "";
      const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
      if (secret !== GMAIL_PUSH_SECRET && !isServiceRole) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (ACCOUNTS.length === 0) {
        return jsonResponse({ error: "No Gmail accounts configured" }, 500);
      }

      const supabase = getSupabaseClient();
      const results: Array<{
        email: string;
        status: "ok" | "error";
        expiration?: string;
        historyId?: string;
        error?: string;
      }> = [];

      for (const account of ACCOUNTS) {
        try {
          const accessToken = await getGmailAccessToken(account);
          const watchResult = await gmailWatch(accessToken, PUBSUB_TOPIC);

          const currentState = await getAccountState(supabase, account.email);
          const nextState: AccountState = {
            historyId: currentState.historyId === "0" ? watchResult.historyId : currentState.historyId,
            expiry: Number(watchResult.expiration),
          };
          await setAccountState(supabase, account.email, nextState);

          console.log(`[renew-watch] ${account.email} OK. Expiry: ${watchResult.expiration}, historyId: ${watchResult.historyId}`);
          results.push({
            email: account.email,
            status: "ok",
            expiration: watchResult.expiration,
            historyId: watchResult.historyId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[renew-watch] ${account.email} FAIL:`, msg);
          results.push({ email: account.email, status: "error", error: msg });
        }
      }

      const allOk = results.every((r) => r.status === "ok");
      return jsonResponse({
        status: allOk ? "watch_renewed" : "partial_failure",
        accounts: results,
      }, allOk ? 200 : 207);
    }

    // =========================================================================
    // Route 2: Pub/Sub push notification
    // =========================================================================

    // Verify OIDC token neu da enable (xem PUBSUB_OIDC_AUDIENCE env).
    // Khi disabled -> bo qua, tin cay gateway + allowlist email trong ACCOUNTS.
    const oidcResult = await verifyPubsubOidc(req);
    if (!oidcResult.ok) {
      console.warn(`[push] OIDC reject: ${oidcResult.reason}`);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const pubsubPayload = body as PubSubPushPayload;
    if (!pubsubPayload.message?.data) {
      return jsonResponse({ error: "Invalid Pub/Sub payload" }, 400);
    }

    const rawData = decodeBase64Url(pubsubPayload.message.data);
    const pushData: GmailPushData = JSON.parse(rawData);
    console.log(`[push] Email: ${pushData.emailAddress}, historyId: ${pushData.historyId}`);

    // Lookup account theo emailAddress tu payload
    const account = ACCOUNTS.find((a) => a.email === pushData.emailAddress);
    if (!account) {
      console.warn(`[push] Rejected: email ${pushData.emailAddress} khong co trong ACCOUNTS`);
      return jsonResponse({ error: "Unauthorized email" }, 403);
    }

    const supabase = getSupabaseClient();
    const state = await getAccountState(supabase, account.email);

    // Lan dau: chi luu historyId, khong xu ly
    if (state.historyId === "0") {
      await setAccountState(supabase, account.email, { ...state, historyId: pushData.historyId });
      console.log(`[push] ${account.email} initialized historyId:`, pushData.historyId);
      return jsonResponse({ status: "initialized" });
    }

    const accessToken = await getGmailAccessToken(account);

    let history: GmailHistoryResponse;
    try {
      history = await gmailHistoryList(accessToken, state.historyId);
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { status?: number }).status === 404) {
        await setAccountState(supabase, account.email, { ...state, historyId: pushData.historyId });
        console.warn(`[push] ${account.email} historyId stale, reset to:`, pushData.historyId);
        return jsonResponse({ status: "historyId_reset" });
      }
      throw err;
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (const record of history.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        const msgId = added.message.id;

        try {
          const message = await gmailMessageGet(accessToken, msgId);

          const fromHeader = message.payload.headers.find(
            (h) => h.name.toLowerCase() === "from",
          );
          if (!fromHeader?.value?.includes("support@timo.vn")) {
            skippedCount++;
            continue;
          }

          const emailBody = extractEmailBody(message);
          const parsed = parseTimoEmail(emailBody, msgId);
          if (!parsed) {
            console.warn(`[push] ${account.email} khong parse duoc email: ${msgId}`);
            skippedCount++;
            continue;
          }

          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "process_incoming_bank_transfer",
            {
              p_amount: parsed.amount,
              p_memo: parsed.memo,
              p_bank_ref_id: parsed.transId,
            },
          );

          if (rpcError) {
            console.error(`[push] ${account.email} RPC error msg ${msgId}:`, rpcError.message);
          } else {
            console.log(`[push] ${account.email} processed ${msgId}:`, JSON.stringify(rpcResult));
            processedCount++;
          }
        } catch (msgErr) {
          console.error(`[push] ${account.email} error msg ${msgId}:`, msgErr);
        }
      }
    }

    await setAccountState(supabase, account.email, { ...state, historyId: pushData.historyId });

    console.log(`[push] ${account.email} Done. Processed: ${processedCount}, Skipped: ${skippedCount}`);
    return jsonResponse({ status: "ok", email: account.email, processed: processedCount, skipped: skippedCount });

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
