import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Retry fetch wrapper: PostgREST local thỉnh thoảng trả 502/503
// "upstream response invalid" khi nhiều test chạy song song. Retry nhẹ để
// tránh flaky infra mà không che lỗi business thực.
const createRetryFetch = (retries = 3, baseDelayMs = 120) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastErr: unknown = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(input, init);
        // Retry các 5xx gateway errors (502/503/504) + 408 timeout
        if ([408, 502, 503, 504].includes(res.status) && i < retries) {
          await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
    throw lastErr;
  };
};

// ─── Local config ────────────────────────────────────────────────────────────
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// ─── Production config ───────────────────────────────────────────────────────
const PROD_URL = "https://iudkexocalqdhxuyjacu.supabase.co";
const PROD_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGtleG9jYWxxZGh4dXlqYWN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE0MDk3MiwiZXhwIjoyMDc3NzE2OTcyfQ.zRb5ctyyTik5JtwDu9TTnXiNAcfd-3NsFnt4n9XNyNM";
const PROD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGtleG9jYWxxZGh4dXlqYWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNDA5NzIsImV4cCI6MjA3NzcxNjk3Mn0.TryofMnEhsBsgiUv29mOtn7yuR55FZCYrM8Xv1wmtQg";

// ─── Select based on TEST_TARGET env var ─────────────────────────────────────
const isProd = process.env.TEST_TARGET === "prod";

const SUPABASE_URL = isProd ? PROD_URL : LOCAL_URL;
const SERVICE_ROLE_KEY = isProd ? PROD_SERVICE_KEY : LOCAL_SERVICE_KEY;
const ANON_KEY = isProd ? PROD_ANON_KEY : LOCAL_ANON_KEY;

export const isProduction = isProd;

const retryFetch = createRetryFetch();

/** Admin client — bypasses RLS, used for setup/teardown */
export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: retryFetch },
});

/** Create an authenticated client for a specific user */
export async function createUserClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: retryFetch },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}
