import { Client } from "pg";

/**
 * Global setup cho integration tests (test:rpc).
 *
 * VẤN ĐỀ: DB local thường là clone prod nhưng auth.users bị THIẾU (chỉ vài user)
 * trong khi public.user_roles / public.users đầy đủ. Nhiều trigger/RPC tạo
 * notification cho recipient lấy từ user_roles (theo role/permission). Cột
 * notifications.user_id có FK -> auth.users(id), nên recipient thiếu auth row gây
 * lỗi "notifications_user_id_fkey" -> rollback CẢ transaction (seed PO, ghi
 * payment, idle-tx, bank transfer...) -> hàng loạt integration test fail dù logic
 * nghiệp vụ đúng (prod đủ auth.users nên không gặp).
 *
 * FIX (chỉ LOCAL, idempotent, KHÔNG destructive): backfill auth.users STUB cho mọi
 * user_roles.user_id thiếu auth row. auth.users chỉ cần id (+ is_anonymous/is_sso_user)
 * để thoả FK; stub không có password/email nên KHÔNG đăng nhập được — chỉ đóng vai
 * recipient hợp lệ của notification. auth.users KHÔNG có trigger user-defined nên
 * insert không phát sinh side-effect (không tạo public.users trùng).
 *
 * KHÔNG chạy trên prod (TEST_TARGET=prod) — tuyệt đối không ghi auth.users thật.
 */
export default async function setup() {
  if (process.env.TEST_TARGET === "prod") return;

  const client = new Client({
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  });
  await client.connect();
  try {
    const res = await client.query(`
      INSERT INTO auth.users (id, is_anonymous, is_sso_user)
      SELECT DISTINCT ur.user_id, false, false
      FROM public.user_roles ur
      LEFT JOIN auth.users au ON au.id = ur.user_id
      WHERE au.id IS NULL AND ur.user_id IS NOT NULL
      ON CONFLICT (id) DO NOTHING
    `);
    if (res.rowCount && res.rowCount > 0) {
      console.log(
        `[integration-setup] backfilled ${res.rowCount} auth.users stub (recipient notification)`
      );
    }
  } finally {
    await client.end();
  }
}
