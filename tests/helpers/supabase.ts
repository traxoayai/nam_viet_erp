import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

/** Admin client — bypasses RLS, used for setup/teardown */
export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Create an authenticated client for a specific user */
export async function createUserClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}
