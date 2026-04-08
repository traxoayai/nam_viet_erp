import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV (set via Supabase Dashboard > Edge Functions > Secrets) ---
const SEPAY_BASE_URL = Deno.env.get("SEPAY_BASE_URL") || "https://einvoice-api-sandbox.sepay.vn";
const SEPAY_CLIENT_ID = Deno.env.get("SEPAY_CLIENT_ID") || "";
const SEPAY_CLIENT_SECRET = Deno.env.get("SEPAY_CLIENT_SECRET") || "";
const SEPAY_TEMPLATE_CODE = Deno.env.get("SEPAY_TEMPLATE_CODE") || "2";
const SEPAY_INVOICE_SERIES = Deno.env.get("SEPAY_INVOICE_SERIES") || "";
const SEPAY_PROVIDER_ACCOUNT_ID = Deno.env.get("SEPAY_PROVIDER_ACCOUNT_ID") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Token cache (reuse within 24h) ---
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSepayToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  if (!SEPAY_CLIENT_ID || !SEPAY_CLIENT_SECRET) {
    throw new Error("SEPAY credentials chưa cấu hình (SEPAY_CLIENT_ID / SEPAY_CLIENT_SECRET)");
  }

  const credentials = btoa(`${SEPAY_CLIENT_ID}:${SEPAY_CLIENT_SECRET}`);
  const res = await fetch(`${SEPAY_BASE_URL}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SEPAY token error (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (!json.success || !json.data?.access_token) {
    throw new Error("SEPAY token response invalid");
  }

  cachedToken = json.data.access_token;
  // Refresh 1 hour before expiry
  tokenExpiresAt = Date.now() + (json.data.expires_in - 3600) * 1000;
  return cachedToken!;
}

// --- CORS ---
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").filter(Boolean);

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.length === 0) return origin; // Dev fallback
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_invoice") {
      const sepayToken = await getSepayToken();
      const payload = body.payload;

      // Inject server-side config
      payload.template_code = payload.template_code || SEPAY_TEMPLATE_CODE;
      payload.invoice_series = payload.invoice_series || SEPAY_INVOICE_SERIES;
      payload.provider_account_id = payload.provider_account_id || SEPAY_PROVIDER_ACCOUNT_ID;

      const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sepayToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      const sepayToken = await getSepayToken();
      const { tracking_code } = body;

      const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/create/check/${tracking_code}`, {
        headers: { Authorization: `Bearer ${sepayToken}` },
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (action === "download_invoice") {
      const sepayToken = await getSepayToken();
      const { tracking_code, type } = body as { tracking_code?: string; type?: "pdf" | "xml" };

      if (!tracking_code) {
        return new Response(JSON.stringify({ success: false, error: "tracking_code is required" }), {
          status: 400,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        `${SEPAY_BASE_URL}/v1/invoices/${tracking_code}/download?type=${type ?? "pdf"}`,
        { headers: { Authorization: `Bearer ${sepayToken}` } },
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
