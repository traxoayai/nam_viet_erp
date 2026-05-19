import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { login } from "./helpers/auth";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function resetE2ESession() {
  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  // Tìm e2e-customer@test.com user id từ auth.users qua RPC list
  // (không gọi auth admin để tránh quyền — dùng chat_sessions filter qua join logic phía SQL)
  // Cách đơn giản: reset mọi chat_session có handoff E2E (reason có "E2E")
  const { data: handoffs } = await svc
    .from("chat_handoffs")
    .select("session_id")
    .ilike("reason", "%E2E%");
  const ids = (handoffs ?? []).map((h) => h.session_id);
  if (ids.length === 0) return;
  await svc
    .from("chat_sessions")
    .update({ status: "handoff_pending", assigned_sales_id: null })
    .in("id", ids);
  // Re-mở handoff (clear resolved_at)
  await svc
    .from("chat_handoffs")
    .update({ resolved_at: null })
    .in("session_id", ids);
  // Xoá tin "sales" để test 2 lại assert được tin mới
  await svc
    .from("chat_messages")
    .delete()
    .eq("role", "sales")
    .in("session_id", ids);
}

test.describe("Chatbot P2 — Inbox / Analytics / Compliance", () => {
  test.beforeEach(async ({ page }) => {
    await resetE2ESession();
    await login(page);
  });

  test("Inbox: render 3 cột + hiện session handoff_pending", async ({
    page,
  }) => {
    await page.goto("/marketing/chatbot/inbox");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("Inbox Chatbot")).toBeVisible({
      timeout: 10_000,
    });

    // Tabs sidebar
    await expect(page.getByRole("tab", { name: /Chờ xử lý/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Đang xử lý/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Đã đóng/i })).toBeVisible();

    // Session E2E seed (handoff_pending) phải xuất hiện
    await expect(page.getByText(/E2E Customer|Khách lạ/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Click vào session → thread + reply box hiển thị
    await page
      .getByText(/E2E Customer|Khách lạ/i)
      .first()
      .click();
    await expect(page.getByText("Thuốc xarelto dùng cho bà bầu")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Nhận phiên" })
    ).toBeVisible();
  });

  test("Inbox: nhận phiên → reply box mở → gửi tin sales", async ({ page }) => {
    await page.goto("/marketing/chatbot/inbox");
    await page.waitForLoadState("networkidle");

    await page
      .getByText(/E2E Customer|Khách lạ/i)
      .first()
      .click();
    await page.getByRole("button", { name: "Nhận phiên" }).click();

    // Sau khi nhận: reply box enabled
    const replyBox = page.getByPlaceholder(/Nhập tin trả lời/i);
    await expect(replyBox).toBeEnabled({ timeout: 10_000 });

    const stamp = Date.now();
    const replyText = `E2E sales reply ${stamp}`;
    await replyBox.fill(replyText);
    await page.getByRole("button", { name: "Gửi" }).click();

    // Tin sales xuất hiện trong thread
    await expect(page.getByText(replyText)).toBeVisible({ timeout: 10_000 });
  });

  test("Analytics: 4 KPI + 2 chart + export CSV button", async ({ page }) => {
    await page.goto("/marketing/chatbot/analytics");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Báo cáo Chatbot")).toBeVisible({
      timeout: 10_000,
    });

    // 4 KPI title
    await expect(page.getByText("Tổng phiên chat")).toBeVisible();
    await expect(page.getByText("Đơn từ bot")).toBeVisible();
    await expect(page.getByText("% chuyển sales")).toBeVisible();
    await expect(page.getByText("Chi phí AI")).toBeVisible();

    // Chart titles
    await expect(page.getByText("Phiên chat & đơn theo ngày")).toBeVisible();
    await expect(page.getByText("Top ý định khách hỏi")).toBeVisible();
    await expect(page.getByText("Câu bot không hiểu")).toBeVisible();

    // Export button
    await expect(
      page.getByRole("button", { name: /Export CSV/i })
    ).toBeVisible();
  });

  test("Compliance: page render + filter buttons", async ({ page }) => {
    await page.goto("/marketing/chatbot/compliance");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Audit tuân thủ Chatbot")).toBeVisible({
      timeout: 10_000,
    });

    // Filter buttons
    await expect(
      page.getByRole("button", { name: "Chờ review" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tất cả" })).toBeVisible();

    // Click "Tất cả" → vẫn render bảng (empty hoặc có data)
    await page.getByRole("button", { name: "Tất cả" }).click();
    await page.waitForTimeout(500);
  });

  test("3 route hoạt động (smoke navigate)", async ({ page }) => {
    // Smoke navigate vào 3 page, verify không 404 + key heading visible
    await page.goto("/marketing/chatbot");
    await page.waitForLoadState("networkidle");
    // /marketing/chatbot redirect → /inbox
    await expect(page).toHaveURL(/\/marketing\/chatbot\/inbox/, {
      timeout: 10_000,
    });

    await page.goto("/marketing/chatbot/analytics");
    await expect(page.getByText("Báo cáo Chatbot")).toBeVisible({
      timeout: 10_000,
    });

    await page.goto("/marketing/chatbot/compliance");
    await expect(page.getByText("Audit tuân thủ Chatbot")).toBeVisible({
      timeout: 10_000,
    });
  });
});
