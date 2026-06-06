/**
 * Test: Hook sinh bút toán kế toán trong verifyInvoice — non-blocking pattern
 *
 * Vì verifyInvoice có nhiều supabase call (select status, update, safeRpc),
 * ta mock toàn bộ supabase + safeRpc, tập trung vào 2 assertions:
 * 1. Sau khi verify thành công, postPurchase(id) được gọi đúng 1 lần.
 * 2. Nếu postPurchase throw, verifyInvoice vẫn resolve true (không re-throw).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: tất cả biến dùng trong vi.mock factory phải được hoisted ─────
const hoisted = vi.hoisted(() => {
  const mockPostPurchase = vi
    .fn<() => Promise<number[]>>()
    .mockResolvedValue([1, 1]);
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const chainObj = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };
  return { mockPostPurchase, mockSingle, mockMaybeSingle, chainObj };
});

// ── Mock accountingService ────────────────────────────────────────────────────
vi.mock("@/features/finance/api/accountingService", () => ({
  accountingService: {
    postPurchase: hoisted.mockPostPurchase,
  },
}));

// ── Mock safeRpc ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

// ── Mock supabase ─────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn().mockReturnValue(hoisted.chainObj),
  },
}));

// Import sau khi mock
import { invoiceService } from "@/features/finance/api/invoiceService";

// ─────────────────────────────────────────────────────────────────────────────
const { mockPostPurchase, mockSingle, mockMaybeSingle, chainObj } = hoisted;

beforeEach(() => {
  vi.clearAllMocks();
  // Restore chainObj methods sau clearAllMocks
  chainObj.select.mockReturnThis();
  chainObj.update.mockReturnThis();
  chainObj.eq.mockReturnThis();
  // Restore default resolved values
  mockPostPurchase.mockResolvedValue([1, 1]);
  // supabase select (check status) → draft
  mockSingle.mockResolvedValue({ data: { status: "draft" }, error: null });
  // supabase update + maybeSingle → data hợp lệ
  mockMaybeSingle.mockResolvedValue({ data: { id: 42 }, error: null });
});

describe("invoiceService.verifyInvoice — accounting hook", () => {
  it("gọi postPurchase(id) sau khi verify thành công", async () => {
    const result = await invoiceService.verifyInvoice(42, {});

    expect(result).toBe(true);
    expect(mockPostPurchase).toHaveBeenCalledTimes(1);
    expect(mockPostPurchase).toHaveBeenCalledWith(42);
  });

  it("non-blocking: verifyInvoice vẫn resolve true dù postPurchase throw", async () => {
    mockPostPurchase.mockRejectedValue(
      new Error("RPC gen_journal_purchase lỗi")
    );

    const result = await invoiceService.verifyInvoice(42, {});

    // Nghiệp vụ verify vẫn thành công
    expect(result).toBe(true);
    // Hook đã được gọi (không bị bỏ qua do lỗi)
    expect(mockPostPurchase).toHaveBeenCalledWith(42);
  });

  it("không gọi postPurchase khi hóa đơn đã verified (early return)", async () => {
    // Hóa đơn đang ở trạng thái 'verified' → branch cập nhật payload rồi return sớm
    // Nhánh verified: từ .from().select().eq().single() trả verified
    // rồi .from().update().eq() trả { error: null }
    mockSingle.mockResolvedValue({ data: { status: "verified" }, error: null });
    // .update().eq() không gọi .single() hay .maybeSingle() — trả trực tiếp
    // Cần eq trả object { error: null } (không mockReturnThis) cho chain update
    chainObj.eq
      .mockReturnValueOnce(chainObj) // eq('id', id) trong select chain → returnThis
      .mockResolvedValueOnce({ data: null, error: null }); // eq('id', id) trong update chain

    const result = await invoiceService.verifyInvoice(42, {});

    expect(result).toBe(true);
    // Early return trước hook → postPurchase không được gọi
    expect(mockPostPurchase).not.toHaveBeenCalled();
  });
});
