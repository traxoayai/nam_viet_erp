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

/** Create an authenticated client for a specific user.
 * Local: nếu login fail → reset password via admin API rồi retry (memo
 * feedback_no_direct_auth_password_update — KHÔNG UPDATE encrypted_password trực tiếp;
 * supabase.auth.admin.updateUserById là Admin API gọi gotrue đúng cách).
 */
export async function createUserClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: retryFetch },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (!error) return client;

  // Login fail. Trên prod KHÔNG retry/reset → throw luôn.
  if (isProd) {
    throw new Error(`Login failed for ${email}: ${error.message}`);
  }

  // Local: tìm user. Ưu tiên RPC _test_find_auth_user_by_email (deterministic);
  // fallback listUsers paginate cho DB cũ chưa migrate.
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    throw new Error(
      `Login failed for ${email}: user không tồn tại trong auth.users`
    );
  }
  const user = { id: userId };
  const { error: resetErr } = await adminClient.auth.admin.updateUserById(
    user.id,
    {
      password,
    }
  );
  if (resetErr) {
    throw new Error(
      `Login failed for ${email}: reset password failed (${resetErr.message})`
    );
  }
  const { error: retryErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (retryErr) {
    throw new Error(
      `Login failed for ${email} after password reset: ${retryErr.message}`
    );
  }
  return client;
}

/**
 * Test fixture user for RPCs yêu cầu auth.uid() (chỉ chạy local).
 * Password reset thủ công trong dev DB — không dùng trên prod.
 */
export const TEST_USER_EMAIL = "kame.ctb@gmail.com";
export const TEST_USER_PASSWORD = "Test@123!";

export async function createTestAuthedClient(): Promise<SupabaseClient> {
  return createUserClient(TEST_USER_EMAIL, TEST_USER_PASSWORD);
}

/**
 * Lookup auth.users.id theo email. RPC `_test_find_auth_user_by_email`
 * (SECURITY DEFINER, service_role) làm primary; fallback listUsers paginate
 * cho DB cũ chưa apply migration `20260518000009_test_find_auth_user_helper`.
 * Trả null nếu không có user.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data: foundId, error: rpcErr } = await adminClient.rpc(
    "_test_find_auth_user_by_email",
    { p_email: email }
  );
  if (!rpcErr && typeof foundId === "string" && foundId.length > 0) {
    return foundId;
  }
  // Fallback listUsers
  for (let page = 1; page <= 20; page++) {
    const { data: list, error: listErr } =
      await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (listErr) break;
    const found = list?.users?.find((u) => u.email === email);
    if (found) return found.id;
    if (!list?.users?.length || list.users.length < 200) break;
  }
  return null;
}
