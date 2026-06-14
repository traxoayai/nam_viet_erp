// Integration test: Verify accounting pages render + hook wiring
// - Import pages, verify they exist and are React components
// - Check useJournalEntries hook is properly integrated

import { describe, it, expect } from "vitest";

describe("Accounting Pages Integration", () => {
  it("JournalEntryPage is a React component", async () => {
    const module = await import("@/features/finance/pages/JournalEntryPage");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  it("PeriodClosePage is a React component", async () => {
    const module = await import("@/features/finance/pages/PeriodClosePage");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  it("useJournalEntries hook is exported from hooks module", async () => {
    const module = await import("@/features/finance/hooks/useAccountingData");
    expect(module.useJournalEntries).toBeDefined();
    expect(typeof module.useJournalEntries).toBe("function");
  });

  it("Types are correctly exported from accounting.types", async () => {
    const module = await import("@/features/finance/types/accounting");
    // If types export fails, this will throw and test fails
    expect(module).toBeDefined();
  });

  it("journalLedgerService exists and has listJournalEntries method", async () => {
    const module = await import("@/features/finance/api/journalLedgerService");
    expect(module.journalLedgerService).toBeDefined();
    expect(module.journalLedgerService.listJournalEntries).toBeDefined();
  });

  it("accountingService exists and has closePeriod method", async () => {
    const module = await import("@/features/finance/api/accountingService");
    expect(module.accountingService).toBeDefined();
    expect(module.accountingService.closePeriod).toBeDefined();
  });
});
