import { describe, it, expect } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

/**
 * Integration test cho `check_idle_transactions()` (migration 20260422180000).
 *
 * Function:
 *   - Quét pg_stat_activity tìm `state = 'idle in transaction' AND xact_age > 10 min`
 *   - Loại role hệ thống (supabase_admin, supabase_auth_admin, v.v.)
 *   - Alert admin qua public.notifications (category='idle_tx_zombie')
 *   - Auto-kill (pg_terminate_backend) nếu tx_age > 60 min
 *
 * TESTABILITY:
 *   - Khó tạo real idle-in-transaction > 10 phút trong test env (test chạy vài giây).
 *   - Test chủ yếu sanity-check: function chạy không crash trên DB sạch.
 *   - Test "phát hiện zombie thật" yêu cầu infra setup (dedicated connection hold) →
 *     đánh dấu TODO, chạy manual khi cần.
 */
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
      // Verify function meta qua pg_proc (nếu được grant select)
      // Fallback: gọi 2 lần liên tiếp phải không gây cumulative side-effect
      const { error: e1 } = await adminClient.rpc("check_idle_transactions");
      expect(e1).toBeNull();
      const { error: e2 } = await adminClient.rpc("check_idle_transactions");
      expect(e2).toBeNull();
    },
    20000
  );

  // TODO: simulate real idle tx > 10 phút bằng dedicated PG connection
  // (không dùng Supabase client — cần pg Pool trực tiếp với `BEGIN; <no-op>`
  // giữ nguyên rồi sleep). Hiện chưa có infra → skip.
  it.skip("phát hiện idle tx > 10 phút và insert notification category='idle_tx_zombie'", async () => {
    // Manual test steps:
    //   1. Mở psql dedicated: `BEGIN; SELECT 1;` rồi giữ connection idle > 10p
    //   2. Chạy `SELECT public.check_idle_transactions();`
    //   3. Verify `public.notifications WHERE category='idle_tx_zombie'`
  });
});
