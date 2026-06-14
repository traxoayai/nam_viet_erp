import { assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

import { buildHtmlEmail } from "./templates.ts";

Deno.test(
  "buildHtmlEmail — payment_reminder: renders order code, remaining amount, portal URL",
  () => {
    const { subject, html } = buildHtmlEmail("payment_reminder", {
      order_code: "SO-260422-9130",
      display_name: "Nhà Thuốc An Bình",
      business_name: "Nhà Thuốc An Bình",
      portal_url: "https://nam-viet-b2b.vercel.app",
      total_amount: 4923400,
      remaining_amount: 4923400,
      hours_left: 22,
      milestone_idx: 1,
    });

    assertStringIncludes(subject, "SO-260422-9130");
    assertStringIncludes(html, "SO-260422-9130");
    assertStringIncludes(html, "Nhà Thuốc An Bình");
    assertStringIncludes(html, "https://nam-viet-b2b.vercel.app");
    assertStringIncludes(html, "4.923.400"); // formatted VND
    assertStringIncludes(html, "Thanh toán ngay"); // CTA button
  }
);

Deno.test(
  "buildHtmlEmail — payment_reminder: urgent styling khi hours_left <= 4",
  () => {
    const { html } = buildHtmlEmail("payment_reminder", {
      order_code: "SO-TEST",
      portal_url: "https://example.com",
      total_amount: 1000,
      remaining_amount: 1000,
      hours_left: 3,
      milestone_idx: 3,
    });

    assertStringIncludes(html, "color:#b91c1c"); // red urgency color
    assertStringIncludes(html, "~3 giờ");
  }
);

Deno.test(
  "buildHtmlEmail — payment_reminder: fallback khi display_name thiếu",
  () => {
    const { html } = buildHtmlEmail("payment_reminder", {
      order_code: "SO-TEST",
      business_name: "Company X",
      portal_url: "#",
      total_amount: 1000,
      remaining_amount: 500,
      hours_left: 10,
      milestone_idx: 2,
    });

    assertStringIncludes(html, "Company X");
  }
);

Deno.test("buildHtmlEmail — registration_received: subject + greeting", () => {
  const { subject, html } = buildHtmlEmail("registration_received", {
    business_name: "Hiệu Thuốc Minh Tâm",
  });

  assertStringIncludes(subject, "Nam Việt");
  assertStringIncludes(html, "Hiệu Thuốc Minh Tâm");
  assertStringIncludes(html, "Đang chờ duyệt");
});

Deno.test("buildHtmlEmail — admin_new_order: amount formatted VND", () => {
  const { html } = buildHtmlEmail("admin_new_order", {
    order_code: "SO-001",
    customer_name: "KH A",
    total_amount: 12345678,
  });

  assertStringIncludes(html, "SO-001");
  assertStringIncludes(html, "12.345.678 đ");
});
