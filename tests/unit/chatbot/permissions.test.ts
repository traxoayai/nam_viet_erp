import { describe, it, expect } from "vitest";

import { PERMISSIONS } from "@/features/auth/constants/permissions";

describe("PERMISSIONS.CHATBOT", () => {
  it("có đầy đủ 4 key", () => {
    expect(PERMISSIONS.CHATBOT).toEqual({
      HANDLE: "crm.chatbot.handle",
      ADMIN: "crm.chatbot.admin",
      VIEW_ANALYTICS: "crm.chatbot.view_analytics",
      AUDIT: "crm.chatbot.audit",
    });
  });
});
