#!/usr/bin/env node
/**
 * Seed test users on LOCAL Supabase ONLY.
 *
 * Reset password cho fixture user `kame.ctb@gmail.com` về `Test@123!` qua
 * Admin API (KHÔNG UPDATE auth.users.encrypted_password trực tiếp — gotrue
 * hash crypt() không verify được).
 *
 * Tests cần authedClient (b2b-warehouse-consistency, ...) sẽ pass khi user
 * này có password match TEST_USER_PASSWORD trong helpers/supabase.ts.
 *
 * Usage:
 *   node scripts/seed-test-users.mjs
 *
 * SAFETY:
 *   - HARD CHECK: chỉ chạy nếu SUPABASE_URL = http://127.0.0.1:54321 (local).
 *   - Refuse chạy trên PROD URL.
 */
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_USERS = [{ email: "kame.ctb@gmail.com", password: "Test@123!" }];

async function main() {
  const url = process.env.SUPABASE_URL || LOCAL_URL;
  if (url !== LOCAL_URL) {
    console.error(`REFUSE: chỉ chạy trên ${LOCAL_URL}, không phải ${url}`);
    process.exit(1);
  }

  const admin = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const u of TEST_USERS) {
    // listUsers SDK đôi khi "Database error finding users" trên local Postgres
    // — dùng RPC _test_find_auth_user_by_email (SECURITY DEFINER, service_role)
    // làm primary; fallback listUsers nếu RPC chưa migrate trên DB cũ.
    let existing = null;
    const { data: foundId, error: rpcErr } = await admin.rpc(
      "_test_find_auth_user_by_email",
      { p_email: u.email },
    );
    if (!rpcErr && typeof foundId === "string" && foundId.length > 0) {
      existing = { id: foundId, email: u.email };
    } else {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (listErr) {
        console.error(`listUsers fail:`, listErr.message);
        process.exit(1);
      }
      existing = list.users.find((x) => x.email === u.email);
    }

    if (!existing) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (createErr) {
        console.error(`create ${u.email} fail:`, createErr.message);
        process.exit(1);
      }
      console.log(`✓ created ${u.email}`);
    } else {
      const { error: updErr } = await admin.auth.admin.updateUserById(
        existing.id,
        { password: u.password, email_confirm: true }
      );
      if (updErr) {
        console.error(`update ${u.email} fail:`, updErr.message);
        process.exit(1);
      }
      console.log(`✓ reset password ${u.email}`);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
