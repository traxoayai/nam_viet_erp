import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// vi.mock phải dùng factory không tham chiếu biến ngoài (vì bị hoist lên đầu)
// ────────────────────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/supabaseClient", () => {
  const makeMockRange = vi.fn();
  const makeMockOrder = vi.fn();
  const makeMockEq = vi.fn();
  const makeMockGte = vi.fn();
  const makeMockLte = vi.fn();
  const makeMockSelect = vi.fn();
  const makeMockFrom = vi.fn();

  const builder = {
    select: makeMockSelect,
    order: makeMockOrder,
    range: makeMockRange,
    eq: makeMockEq,
    gte: makeMockGte,
    lte: makeMockLte,
  };

  makeMockSelect.mockReturnValue(builder);
  makeMockOrder.mockReturnValue(builder);
  makeMockEq.mockReturnValue(builder);
  makeMockGte.mockReturnValue(builder);
  makeMockLte.mockReturnValue(builder);
  makeMockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: makeMockFrom,
    },
  };
});

import { journalLedgerService } from "@/features/finance/api/journalLedgerService";
import { supabase } from "@/shared/lib/supabaseClient";

// Helper lấy mock function từ mock module
const getFrom = () =>
  (supabase as unknown as unknown).from as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Re-setup chains sau clearAllMocks
  const from = (supabase as unknown as unknown).from as ReturnType<
    typeof vi.fn
  >;
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  };
  // mockReturnThis trả về builder object (self)
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  from.mockReturnValue(builder);
  // Expose builder trên from mock để test có thể truy cập
  (from as unknown)._builder = builder;
});

// Helper để lấy builder hiện tại
const getBuilder = () =>
  (getFrom() as unknown)._builder as Record<string, ReturnType<typeof vi.fn>>;

// ────────────────────────────────────────────────────────────────────────────
// listJournalEntries
// ────────────────────────────────────────────────────────────────────────────

describe("journalLedgerService.listJournalEntries", () => {
  it("query đúng bảng journal_entries và range phân trang page=1 pageSize=20", async () => {
    const mockData = [
      {
        id: 1,
        book: "vat",
        entry_date: "2026-06-01",
        doc_type: "sale",
        status: "posted",
        total_debit: 1000000,
        total_credit: 1000000,
        description: "Test",
      },
    ];
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: mockData, error: null, count: 1 });

    const result = await journalLedgerService.listJournalEntries({
      page: 1,
      pageSize: 20,
    });

    expect(getFrom()).toHaveBeenCalledWith("journal_entries");
    // page=1, pageSize=20 → from=0, to=19
    expect(b.range).toHaveBeenCalledWith(0, 19);
    expect(b.order).toHaveBeenCalledWith("entry_date", { ascending: false });
    expect(result.data).toEqual(mockData);
    expect(result.total).toBe(1);
  });

  it("trả về {data:[], total:0} khi không có kết quả", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: null, error: null, count: null });

    const result = await journalLedgerService.listJournalEntries({
      page: 2,
      pageSize: 10,
    });

    // page=2, pageSize=10 → from=10, to=19
    expect(b.range).toHaveBeenCalledWith(10, 19);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("áp dụng filter book khi truyền vào", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    await journalLedgerService.listJournalEntries({
      book: "vat",
      page: 1,
      pageSize: 20,
    });

    expect(b.eq).toHaveBeenCalledWith("book", "vat");
  });

  it("áp dụng filter status khi truyền vào", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    await journalLedgerService.listJournalEntries({
      status: "draft",
      page: 1,
      pageSize: 20,
    });

    expect(b.eq).toHaveBeenCalledWith("status", "draft");
  });

  it("áp dụng filter docType khi truyền vào", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    await journalLedgerService.listJournalEntries({
      docType: "purchase",
      page: 1,
      pageSize: 20,
    });

    expect(b.eq).toHaveBeenCalledWith("doc_type", "purchase");
  });

  it("áp dụng filter dateFrom và dateTo", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    await journalLedgerService.listJournalEntries({
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      page: 1,
      pageSize: 20,
    });

    expect(b.gte).toHaveBeenCalledWith("entry_date", "2026-01-01");
    expect(b.lte).toHaveBeenCalledWith("entry_date", "2026-06-30");
  });

  it("throw Error khi supabase trả về error", async () => {
    const b = getBuilder();
    b.range.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS denied" },
      count: null,
    });

    await expect(
      journalLedgerService.listJournalEntries({ page: 1, pageSize: 20 })
    ).rejects.toThrow("RLS denied");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getJournalLines — chain: .from().select().eq().order()
// ────────────────────────────────────────────────────────────────────────────

describe("journalLedgerService.getJournalLines", () => {
  it("query đúng bảng journal_entry_lines với entryId và order line_no", async () => {
    const b = getBuilder();
    // Terminal call: .order() sau .eq()
    const orderMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: 10,
          entry_id: 5,
          account_id: "acc-001",
          debit: 500000,
          credit: 0,
          partner_id: null,
          description: "Hàng mua",
          line_no: 1,
          chart_of_accounts: { account_code: "156", name: "Hàng hóa" },
        },
        {
          id: 11,
          entry_id: 5,
          account_id: "acc-002",
          debit: 0,
          credit: 500000,
          partner_id: "partner-abc",
          description: null,
          line_no: 2,
          chart_of_accounts: { account_code: "331", name: "Phải trả NCC" },
        },
      ],
      error: null,
    });
    b.eq.mockReturnValueOnce({ order: orderMock });

    const result = await journalLedgerService.getJournalLines(5);

    expect(getFrom()).toHaveBeenCalledWith("journal_entry_lines");
    expect(b.eq).toHaveBeenCalledWith("entry_id", 5);
    expect(orderMock).toHaveBeenCalledWith("line_no", { ascending: true });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      account_code: "156",
      account_name: "Hàng hóa",
      debit: 500000,
      credit: 0,
      line_no: 1,
    });
    expect(result[1]).toMatchObject({
      account_code: "331",
      account_name: "Phải trả NCC",
      partner_id: "partner-abc",
      credit: 500000,
    });
  });

  it("trả về [] khi không có dữ liệu", async () => {
    const b = getBuilder();
    const orderMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null });
    b.eq.mockReturnValueOnce({ order: orderMock });

    const result = await journalLedgerService.getJournalLines(99);

    expect(result).toEqual([]);
  });

  it("xử lý chart_of_accounts null — trả account_code và account_name rỗng", async () => {
    const b = getBuilder();
    const orderMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: 20,
          entry_id: 7,
          account_id: "acc-xxx",
          debit: 100,
          credit: 0,
          partner_id: null,
          description: null,
          line_no: 1,
          chart_of_accounts: null,
        },
      ],
      error: null,
    });
    b.eq.mockReturnValueOnce({ order: orderMock });

    const result = await journalLedgerService.getJournalLines(7);

    expect(result[0].account_code).toBe("");
    expect(result[0].account_name).toBe("");
  });

  it("xử lý chart_of_accounts dạng array (Supabase foreign key) — lấy phần tử đầu", async () => {
    const b = getBuilder();
    const orderMock = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: 30,
          entry_id: 8,
          account_id: "acc-yyy",
          debit: 200000,
          credit: 0,
          partner_id: null,
          description: null,
          line_no: 1,
          chart_of_accounts: [{ account_code: "111", name: "Tiền mặt" }],
        },
      ],
      error: null,
    });
    b.eq.mockReturnValueOnce({ order: orderMock });

    const result = await journalLedgerService.getJournalLines(8);

    expect(result[0].account_code).toBe("111");
    expect(result[0].account_name).toBe("Tiền mặt");
  });

  it("throw Error khi supabase trả về error", async () => {
    const b = getBuilder();
    const orderMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: "Permission denied" },
    });
    b.eq.mockReturnValueOnce({ order: orderMock });

    await expect(journalLedgerService.getJournalLines(1)).rejects.toThrow(
      "Permission denied"
    );
  });
});
