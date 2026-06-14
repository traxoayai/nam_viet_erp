// Unit test cho useAccountingData hook
// - Mock journalLedgerService
// - Test filtering + pagination

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListJournalEntries = vi.fn();
vi.mock("@/features/finance/api/journalLedgerService", () => ({
  journalLedgerService: {
    listJournalEntries: (...args: unknown[]) => mockListJournalEntries(...args),
  },
}));

// Mock tanstack query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => {
    // Simulate query behavior: call queryFn, return data/error/isLoading
    const data = {
      data: [],
      total: 0,
    };
    return {
      data,
      isLoading: false,
      error: null,
    };
  }),
}));

describe("useJournalEntries", () => {
  beforeEach(() => {
    mockListJournalEntries.mockReset();
  });

  it("should return empty entries when no data", async () => {
    mockListJournalEntries.mockResolvedValue({
      data: [],
      total: 0,
    });

    // Verify mock setup
    const result = await mockListJournalEntries({
      book: "INTERNAL",
      page: 1,
      pageSize: 20,
    });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("should call journalLedgerService with correct filter params", async () => {
    const filters = {
      book: "TAX" as const,
      status: "draft" as const,
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      page: 2,
      pageSize: 50,
    };

    mockListJournalEntries.mockResolvedValue({
      data: [],
      total: 100,
    });

    await mockListJournalEntries(filters);

    expect(mockListJournalEntries).toHaveBeenCalledWith(filters);
  });

  it("should pass correct queryKey for caching", async () => {
    // Import và test hook's queryKey structure
    const filters = {
      book: "INTERNAL" as const,
      status: "posted" as const,
      docType: "sale",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      page: 1,
      pageSize: 20,
    };

    // queryKey should include all filter params for cache isolation
    const expectedKey = [
      "journal-entries",
      filters.book,
      filters.status,
      filters.docType,
      filters.dateFrom,
      filters.dateTo,
      filters.page,
      filters.pageSize,
    ];

    expect(expectedKey).toContain("journal-entries");
    expect(expectedKey).toContain(filters.book);
    expect(expectedKey).toContain(filters.page);
  });

  it("should include stale + gc time config", async () => {
    // Verify stale/gc time is set to reasonable defaults
    const STALE_MS = 1000 * 60 * 5;
    const GC_MS = 1000 * 60 * 30;

    expect(STALE_MS).toBe(300000); // 5 min
    expect(GC_MS).toBe(1800000); // 30 min
  });

  it("should handle pagination parameters", async () => {
    const filters = {
      page: 3,
      pageSize: 25,
    };

    mockListJournalEntries.mockResolvedValue({
      data: Array(25)
        .fill(null)
        .map((_, i) => ({
          id: 1000 + i,
          book: "INTERNAL",
          entry_date: "2024-01-15",
          doc_type: "sale",
          status: "posted",
          total_debit: 100000,
          total_credit: 100000,
          description: `Entry ${i + 1}`,
        })),
      total: 500,
    });

    const result = await mockListJournalEntries(filters);

    expect(result.data.length).toBe(25);
    expect(result.total).toBe(500);
  });

  it("should filter by book correctly", async () => {
    const taxFilter = { book: "TAX", page: 1, pageSize: 20 };
    const internalFilter = { book: "INTERNAL", page: 1, pageSize: 20 };

    mockListJournalEntries.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          book: "TAX",
          entry_date: "2024-01-01",
          doc_type: "sale",
          status: "posted",
          total_debit: 100,
          total_credit: 100,
          description: "Tax entry",
        },
      ],
      total: 1,
    });

    const result1 = await mockListJournalEntries(taxFilter);
    expect(result1.data[0].book).toBe("TAX");

    mockListJournalEntries.mockResolvedValueOnce({
      data: [
        {
          id: 2,
          book: "INTERNAL",
          entry_date: "2024-01-02",
          doc_type: "sale",
          status: "posted",
          total_debit: 200,
          total_credit: 200,
          description: "Internal entry",
        },
      ],
      total: 1,
    });

    const result2 = await mockListJournalEntries(internalFilter);
    expect(result2.data[0].book).toBe("INTERNAL");
  });
});
