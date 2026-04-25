import { Client } from "pg";
import { describe, it, expect } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

/**
 * Integration test cho `check_idle_transactions(p_threshold_minutes INT)`
 * (migrations 20260422180000 + 20260425300000).
 *
 * Function:
 *   - Quét pg_stat_activity tìm `state = 'idle in transaction' AND
 *     xact_age > p_threshold_minutes` (default 10)
 *   - Loại role hệ thống (supabase_admin, supabase_auth_admin, v.v.)
 *   - Alert admin qua public.notifications (category='idle_tx_zombie')
 *   - Auto-kill (pg_terminate_backend) nếu tx_age > 60 min
 *
 * TESTABILITY:
 *   - Tạo idle-in-transaction qua dedicated `pg.Client` (BEGIN; query; idle).
 *   - Gọi RPC với p_threshold_minutes=0 để fire ngay không chờ 10 phút.
 *   - Skip nếu không kết nối được local Postgres trực tiếp.
 */

const LOCAL_PG_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("check_idle_transactions", () => {
  const skipOnProd = isProduction;

  it.skipIf(skipOnProd)(
    "chạy không crash trên DB không có idle tx > 10 phút",
    async () => {
      const { error } = await adminClient.rpc("check_idle_transactions");
      expect(error).toBeNull();
    },
    20000
  );

  it.skipIf(skipOnProd)(
    "function tồn tại với signature void, callable qua service_role",
    async () => {
      const { error: e1 } = await adminClient.rpc("check_idle_transactions");
      expect(e1).toBeNull();
      const { error: e2 } = await adminClient.rpc("check_idle_transactions");
      expect(e2).toBeNull();
    },
    20000
  );

  it.skipIf(skipOnProd)(
    "phát hiện idle tx > 0 phút và insert notification category='idle_tx_zombie'",
    async (ctx) => {
      // Tạo dedicated PG client để giữ idle-in-transaction.
      const holder = new Client({ connectionString: LOCAL_PG_URL });
      try {
        await holder.connect();
      } catch {
        // Local PG không kết nối trực tiếp được (sandbox/firewall) → skip.
        return ctx.skip();
      }

      let pid: number | null = null;
      try {
        // Lấy pid của connection holder
        const pidRes = await holder.query<{ pg_backend_pid: number }>(
          "SELECT pg_backend_pid()"
        );
        pid = pidRes.rows[0]!.pg_backend_pid;
        expect(pid).toBeGreaterThan(0);

        // BEGIN — giữ idle-in-transaction
        await holder.query("BEGIN");
        await holder.query("SELECT 1");
        // Chờ pg_stat_activity cập nhật state (vài chục ms)
        await new Promise((r) => setTimeout(r, 300));

        // Verify state pre-RPC
        const { data: pre } = await adminClient
          .from("notifications")
          .select("id")
          .eq("category", "idle_tx_zombie")
          .filter("metadata->>pid", "eq", String(pid));
        const countBefore = (pre ?? []).length;

        // Fire RPC với threshold=0 → bắt mọi idle tx ngay
        const { error: rpcErr } = await adminClient.rpc(
          "check_idle_transactions",
          { p_threshold_minutes: 0 }
        );
        expect(rpcErr).toBeNull();

        const { data: post } = await adminClient
          .from("notifications")
          .select("id, category, metadata")
          .eq("category", "idle_tx_zombie")
          .filter("metadata->>pid", "eq", String(pid));
        // Phải có ít nhất 1 notification mới cho pid này
        expect((post ?? []).length).toBeGreaterThan(countBefore);
        const newest = (post ?? [])[(post ?? []).length - 1];
        expect((newest!.metadata as Record<string, unknown>).pid).toBe(pid);
      } finally {
        try {
          await holder.query("ROLLBACK");
        } catch {
          /* connection may be terminated */
        }
        try {
          await holder.end();
        } catch {
          /* ignore */
        }
        // Cleanup notification rows tạo bởi test (theo pid)
        if (pid !== null) {
          await adminClient
            .from("notifications")
            .delete()
            .eq("category", "idle_tx_zombie")
            .filter("metadata->>pid", "eq", String(pid));
        }
      }
    },
    30000
  );
});
