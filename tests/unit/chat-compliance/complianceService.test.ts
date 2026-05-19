// Unit test cho complianceService (Agent G3).
// - Mock safeRpc, verify mỗi function gọi đúng RPC name + params đúng PG types
//   (date dùng null khi rỗng, KHÔNG bao giờ "").

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: unknown[]) => mockSafeRpc(...args),
}));

import {
  getComplianceAuditDetail,
  getComplianceAuditStats,
  listComplianceAudits,
} from "@/features/chat-compliance/services/complianceService";

describe("complianceService unit", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  describe("listComplianceAudits", () => {
    it("gọi list_chat_compliance_audits với đầy đủ filter + pagination", async () => {
      mockSafeRpc.mockResolvedValue({ data: [], error: null });
      await listComplianceAudits({
        from: "2026-05-10",
        to: "2026-05-18",
        severity: "high",
        limit: 50,
        offset: 25,
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("list_chat_compliance_audits", {
        p_from: "2026-05-10",
        p_to: "2026-05-18",
        p_severity: "high",
        p_limit: 50,
        p_offset: 25,
      });
    });

    it("severity null khi không truyền (KHÔNG dùng chuỗi rỗng)", async () => {
      mockSafeRpc.mockResolvedValue({ data: [], error: null });
      await listComplianceAudits({
        from: "2026-05-10",
        to: "2026-05-18",
      });
      const call = mockSafeRpc.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(call.p_severity).toBeNull();
      // Pagination default
      expect(call.p_limit).toBe(100);
      expect(call.p_offset).toBe(0);
    });

    it("from/to rỗng vẫn pass null (không pass empty string)", async () => {
      mockSafeRpc.mockResolvedValue({ data: [], error: null });
      await listComplianceAudits({
        from: "",
        to: "",
      });
      const call = mockSafeRpc.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(call.p_from).toBeNull();
      expect(call.p_to).toBeNull();
    });

    it("trả về data từ safeRpc", async () => {
      const fixture = [
        {
          audit_id: "a1",
          severity: "high",
          rule_code: "R-04",
          message_id: "m1",
          session_id: "s1",
          matched_keywords: ["liều"],
          excerpt: "test",
          status: "open",
          customer_email: "x@x",
          customer_name: "X",
          audit_created_at: "2026-05-18T00:00:00Z",
        },
      ];
      mockSafeRpc.mockResolvedValue({ data: fixture, error: null });
      const out = await listComplianceAudits({
        from: "2026-05-10",
        to: "2026-05-18",
      });
      expect(out).toEqual(fixture);
    });

    it("throw khi safeRpc trả error", async () => {
      const fakeErr = { code: "42501", message: "denied" };
      mockSafeRpc.mockResolvedValue({ data: null, error: fakeErr });
      await expect(
        listComplianceAudits({ from: "2026-05-10", to: "2026-05-18" })
      ).rejects.toBe(fakeErr);
    });

    it("data null → trả mảng rỗng (không throw)", async () => {
      mockSafeRpc.mockResolvedValue({ data: null, error: null });
      const out = await listComplianceAudits({
        from: "2026-05-10",
        to: "2026-05-18",
      });
      expect(out).toEqual([]);
    });
  });

  describe("getComplianceAuditDetail", () => {
    it("gọi get_compliance_audit_detail với p_audit_id uuid", async () => {
      const detail = {
        audit: { id: "a1" },
        anchor_message: null,
        messages_before: [],
        messages_after: [],
        customer: {},
      };
      mockSafeRpc.mockResolvedValue({ data: detail, error: null });
      const out = await getComplianceAuditDetail("a1-uuid");
      expect(mockSafeRpc).toHaveBeenCalledWith("get_compliance_audit_detail", {
        p_audit_id: "a1-uuid",
      });
      expect(out).toBe(detail);
    });

    it("throw khi safeRpc trả error", async () => {
      const fakeErr = { code: "42501", message: "denied" };
      mockSafeRpc.mockResolvedValue({ data: null, error: fakeErr });
      await expect(getComplianceAuditDetail("a1")).rejects.toBe(fakeErr);
    });
  });

  describe("getComplianceAuditStats", () => {
    it("gọi get_compliance_audit_stats với p_from/p_to date strings", async () => {
      const stats = {
        total: 0,
        by_severity: { high: 0, medium: 0, low: 0 },
        by_day: [],
      };
      mockSafeRpc.mockResolvedValue({ data: stats, error: null });
      const out = await getComplianceAuditStats("2026-05-10", "2026-05-18");
      expect(mockSafeRpc).toHaveBeenCalledWith("get_compliance_audit_stats", {
        p_from: "2026-05-10",
        p_to: "2026-05-18",
      });
      expect(out).toBe(stats);
    });

    it("from rỗng → null (không empty string)", async () => {
      mockSafeRpc.mockResolvedValue({
        data: {
          total: 0,
          by_severity: { high: 0, medium: 0, low: 0 },
          by_day: [],
        },
        error: null,
      });
      await getComplianceAuditStats("", "");
      const call = mockSafeRpc.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(call.p_from).toBeNull();
      expect(call.p_to).toBeNull();
    });
  });
});
