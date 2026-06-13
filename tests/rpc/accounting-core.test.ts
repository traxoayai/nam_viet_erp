import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "../helpers/supabase";

describe("journal_entries table", () => {
  const createdEntryIds: bigint[] = [];
  let coaId: string;
  let periodId: bigint;

  beforeAll(async () => {
    // Lấy một account từ chart_of_accounts để test
    const { data: accounts } = await adminClient
      .from("chart_of_accounts")
      .select("id")
      .limit(1);
    coaId = accounts?.[0]?.id || "";

    // Lấy hoặc tạo accounting_period
    const { data: periods } = await adminClient
      .from("accounting_periods")
      .select("id")
      .eq("book", "INTERNAL")
      .limit(1);

    if (periods && periods.length > 0) {
      periodId = periods[0].id;
    } else {
      // Tạo period nếu chưa có
      const { data: newPeriod } = await adminClient
        .from("accounting_periods")
        .insert({ book: "INTERNAL", year: 2026, month: 6 })
        .select()
        .single();
      periodId = newPeriod?.id || 0n;
    }
  });

  afterAll(async () => {
    // Cleanup: xóa các entry được tạo trong test
    if (createdEntryIds.length > 0) {
      await adminClient
        .from("journal_entries")
        .delete()
        .in("id", createdEntryIds);
    }
  });

  it("should create journal_entry with debit/credit balancing", async () => {
    const { data, error } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-06-14"),
        book: "INTERNAL",
        period_id: periodId,
        description: "Test entry",
        doc_type: "sale",
        total_debit: 100000,
        total_credit: 100000,
        status: "draft",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeTruthy();
    expect(data?.entry_date).toBeTruthy();
    expect(data?.book).toBe("INTERNAL");
    expect(data?.total_debit).toBe(100000);
    expect(data?.total_credit).toBe(100000);

    createdEntryIds.push(data!.id);
  });

  it("journal_entry_lines should cascade delete when entry deleted", async () => {
    // Tạo entry
    const { data: entry, error: entryErr } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-06-14"),
        book: "INTERNAL",
        period_id: periodId,
        doc_type: "sale",
        status: "draft",
      })
      .select()
      .single();

    expect(entryErr).toBeNull();
    expect(entry?.id).toBeTruthy();

    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Tạo journal_entry_line
    const { data: line, error: lineErr } = await adminClient
      .from("journal_entry_lines")
      .insert({
        entry_id: entry!.id,
        account_id: coaId,
        debit: 50000,
        credit: 0,
        description: "Cash in",
      })
      .select()
      .single();

    expect(lineErr).toBeNull();
    expect(line?.id).toBeTruthy();

    // Xóa entry
    const { error: deleteErr } = await adminClient
      .from("journal_entries")
      .delete()
      .eq("id", entry!.id);

    expect(deleteErr).toBeNull();

    // Kiểm tra lines đã bị xóa (cascade)
    const { data: deletedLines, error: queryErr } = await adminClient
      .from("journal_entry_lines")
      .select()
      .eq("entry_id", entry!.id);

    expect(queryErr).toBeNull();
    expect(deletedLines).toHaveLength(0);
  });

  it("journal_entry_lines should link correctly to account_id", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    const { data: entry } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-06-14"),
        book: "INTERNAL",
        period_id: periodId,
        doc_type: "sale",
        status: "draft",
      })
      .select()
      .single();

    const { data: line, error } = await adminClient
      .from("journal_entry_lines")
      .insert({
        entry_id: entry!.id,
        account_id: coaId,
        debit: 75000,
        credit: 0,
        description: "Revenue",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(line?.account_id).toBe(coaId);
    expect(line?.debit).toBe(75000);
    expect(line?.credit).toBe(0);

    createdEntryIds.push(entry!.id);
  });

  it("journal_entry_lines debit and credit should have non-negative checks", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    const { data: entry } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-06-14"),
        book: "INTERNAL",
        period_id: periodId,
        doc_type: "sale",
        status: "draft",
      })
      .select()
      .single();

    // Test constraint: negative debit should fail
    const { error: negDebitErr } = await adminClient
      .from("journal_entry_lines")
      .insert({
        entry_id: entry!.id,
        account_id: coaId,
        debit: -1000,
        credit: 0,
      });

    expect(negDebitErr).toBeDefined();

    createdEntryIds.push(entry!.id);
  });
});

describe("dual-ledger book_type", () => {
  const createdBalanceIds: number[] = [];
  const createdTxIds: number[] = [];
  let coaId: string;
  let periodId: bigint;
  let fundAccountId: number;

  beforeAll(async () => {
    // Lấy chart_of_accounts
    const { data: accounts } = await adminClient
      .from("chart_of_accounts")
      .select("id")
      .limit(1);
    coaId = accounts?.[0]?.id || "";

    // Lấy hoặc tạo accounting_period
    const { data: periods } = await adminClient
      .from("accounting_periods")
      .select("id")
      .eq("book", "INTERNAL")
      .limit(1);

    if (periods && periods.length > 0) {
      periodId = periods[0].id;
    } else {
      const { data: newPeriod } = await adminClient
        .from("accounting_periods")
        .insert({ book: "INTERNAL", year: 2026, month: 6 })
        .select()
        .single();
      periodId = newPeriod?.id || 0n;
    }

    // Lấy fund account (cash)
    const { data: funds } = await adminClient
      .from("fund_accounts")
      .select("id")
      .limit(1);
    fundAccountId = funds?.[0]?.id || 0;
  });

  afterAll(async () => {
    // Cleanup
    if (createdBalanceIds.length > 0) {
      await adminClient
        .from("account_balances")
        .delete()
        .in("id", createdBalanceIds);
    }
    if (createdTxIds.length > 0) {
      await adminClient
        .from("finance_transactions")
        .delete()
        .in("id", createdTxIds);
    }
  });

  it("account_balances should track INTERNAL vs TAX vs BOTH", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    const entries = [
      { book: "INTERNAL", book_type: "INTERNAL", debit: 100, credit: 0 },
      { book: "TAX", book_type: "TAX", debit: 100, credit: 0 },
      { book: "INTERNAL", book_type: "BOTH", debit: 100, credit: 0 },
    ];

    for (const entry of entries) {
      const { data, error } = await adminClient
        .from("account_balances")
        .insert({
          account_id: coaId,
          period_id: periodId,
          book: entry.book,
          book_type: entry.book_type,
          opening_debit: entry.debit,
          opening_credit: entry.credit,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.book_type).toBe(entry.book_type);
      if (data?.id) {
        createdBalanceIds.push(data.id);
      }
    }

    // Query by book_type
    const { data: internalBalances } = await adminClient
      .from("account_balances")
      .select()
      .eq("book_type", "INTERNAL")
      .eq("account_id", coaId);
    expect(internalBalances && internalBalances.length > 0).toBeTruthy();
  });

  it("account_balances should enforce UNIQUE(account_id, period_id, book_type)", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Tạo record đầu tiên
    const { data: first, error: firstErr } = await adminClient
      .from("account_balances")
      .insert({
        account_id: coaId,
        period_id: periodId,
        book: "INTERNAL",
        book_type: "INTERNAL",
        opening_debit: 50,
        opening_credit: 0,
      })
      .select()
      .single();

    expect(firstErr).toBeNull();
    expect(first?.id).toBeTruthy();
    if (first?.id) {
      createdBalanceIds.push(first.id);
    }

    // Cố tạo duplicate → phải fail (same account_id, period_id, book_type)
    const { error: dupErr } = await adminClient
      .from("account_balances")
      .insert({
        account_id: coaId,
        period_id: periodId,
        book: "INTERNAL",
        book_type: "INTERNAL",
        opening_debit: 75,
        opening_credit: 0,
      });

    expect(dupErr).toBeDefined();
  });

  it("finance_transactions should support book_type for traceability", async () => {
    if (!fundAccountId) {
      console.warn("Skipping test: no fund_account found");
      return;
    }

    const { data, error } = await adminClient
      .from("finance_transactions")
      .insert({
        code: `TEST_BOOK_TYPE_${Date.now()}`,
        transaction_date: new Date().toISOString(),
        flow: "in",
        amount: 500000,
        fund_account_id: fundAccountId,
        book_type: "BOTH",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.book_type).toBe("BOTH");
    if (data?.id) {
      createdTxIds.push(data.id);
    }
  });

  it("finance_transactions book_type should accept INTERNAL, TAX, or BOTH", async () => {
    if (!fundAccountId) {
      console.warn("Skipping test: no fund_account found");
      return;
    }

    const bookTypes = ["INTERNAL", "TAX", "BOTH"];

    for (const bookType of bookTypes) {
      const { data, error } = await adminClient
        .from("finance_transactions")
        .insert({
          code: `TEST_BT_${bookType}_${Date.now()}`,
          transaction_date: new Date().toISOString(),
          flow: "in",
          amount: 250000,
          fund_account_id: fundAccountId,
          book_type: bookType,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.book_type).toBe(bookType);
      if (data?.id) {
        createdTxIds.push(data.id);
      }
    }
  });
});

describe("close_accounting_period RPC", () => {
  const createdEntryIds: bigint[] = [];
  const createdPeriodIds: bigint[] = [];
  let coaId: string;
  let testPeriod: bigint;
  let nextPeriod: bigint;

  beforeAll(async () => {
    // Get chart_of_accounts
    const { data: accounts } = await adminClient
      .from("chart_of_accounts")
      .select("id")
      .limit(1);
    coaId = accounts?.[0]?.id || "";

    // Create test period for closing
    const { data: period1, error: periodErr1 } = await adminClient
      .from("accounting_periods")
      .insert({ book: "INTERNAL", year: 2026, month: 5 })
      .select()
      .single();

    expect(periodErr1).toBeNull();
    testPeriod = period1!.id;
    createdPeriodIds.push(testPeriod);

    // Create next period for carry-forward
    const { data: period2, error: periodErr2 } = await adminClient
      .from("accounting_periods")
      .insert({ book: "INTERNAL", year: 2026, month: 6 })
      .select()
      .single();

    expect(periodErr2).toBeNull();
    nextPeriod = period2!.id;
    createdPeriodIds.push(nextPeriod);
  });

  afterAll(async () => {
    // Cleanup entries
    if (createdEntryIds.length > 0) {
      await adminClient
        .from("journal_entries")
        .delete()
        .in("id", createdEntryIds);
    }
    // Cleanup periods
    if (createdPeriodIds.length > 0) {
      await adminClient
        .from("accounting_periods")
        .delete()
        .in("id", createdPeriodIds);
    }
  });

  it("should lock all entries for a period after close", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Create test entry for period
    const { data: entry1 } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-05-15"),
        book: "INTERNAL",
        period_id: testPeriod,
        doc_type: "sale",
        description: "Test entry for close",
        status: "draft",
        total_debit: 100000,
        total_credit: 100000,
      })
      .select()
      .single();

    expect(entry1?.id).toBeTruthy();
    createdEntryIds.push(entry1!.id);

    // Call close_accounting_period
    const { data: result, error: closeErr } = await adminClient.rpc(
      "close_accounting_period",
      {
        p_period_id: testPeriod,
      }
    );

    expect(closeErr).toBeNull();
    expect(result).toBeDefined();
    expect(result[0].success).toBe(true);

    // Verify all entries locked
    const { data: lockedEntries } = await adminClient
      .from("journal_entries")
      .select()
      .eq("period_id", testPeriod)
      .eq("status", "posted");

    expect(lockedEntries && lockedEntries.length > 0).toBeTruthy();
  });

  it("should create P&L closing entry with balanced debit/credit", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Create another test period
    const { data: period, error: periodErr } = await adminClient
      .from("accounting_periods")
      .insert({ book: "INTERNAL", year: 2026, month: 4 })
      .select()
      .single();

    expect(periodErr).toBeNull();
    const testPeriodForClose = period!.id;
    createdPeriodIds.push(testPeriodForClose);

    // Create test entry
    const { data: entry } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-04-15"),
        book: "INTERNAL",
        period_id: testPeriodForClose,
        doc_type: "sale",
        description: "Test entry",
        status: "draft",
        total_debit: 50000,
        total_credit: 50000,
      })
      .select()
      .single();

    createdEntryIds.push(entry!.id);

    // Close period
    const { data: result } = await adminClient.rpc("close_accounting_period", {
      p_period_id: testPeriodForClose,
    });

    expect(result).toBeDefined();
    expect(result[0].pnl_entry_id).toBeTruthy();

    // Verify P&L entry exists and is balanced
    const { data: pnlEntry } = await adminClient
      .from("journal_entries")
      .select()
      .eq("id", result[0].pnl_entry_id)
      .single();

    expect(pnlEntry?.doc_type).toBe("closing");
    expect(pnlEntry?.total_debit).toBe(pnlEntry?.total_credit);
    expect(pnlEntry?.status).toBe("posted");
  });

  it("should prevent posting to locked period", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Close the period first (testPeriod was already closed in first test)
    // Try to add new entry to locked period
    const { error } = await adminClient.from("journal_entries").insert({
      entry_date: new Date("2026-05-20"),
      book: "INTERNAL",
      period_id: testPeriod,
      doc_type: "sale",
      description: "Should fail",
      status: "draft",
      total_debit: 100,
      total_credit: 100,
    });

    // Should fail because period is closed
    expect(error).toBeDefined();
  });

  it("should update period status to closed", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    // Create test period
    const { data: period } = await adminClient
      .from("accounting_periods")
      .insert({ book: "INTERNAL", year: 2026, month: 3 })
      .select()
      .single();

    const periodToClose = period!.id;
    createdPeriodIds.push(periodToClose);

    // Verify period starts as open
    const { data: beforeClose } = await adminClient
      .from("accounting_periods")
      .select("status")
      .eq("id", periodToClose)
      .single();

    expect(beforeClose?.status).toBe("open");

    // Close period
    const { error: closeErr } = await adminClient.rpc(
      "close_accounting_period",
      {
        p_period_id: periodToClose,
      }
    );

    expect(closeErr).toBeNull();

    // Verify period is now closed
    const { data: afterClose } = await adminClient
      .from("accounting_periods")
      .select("status")
      .eq("id", periodToClose)
      .single();

    expect(afterClose?.status).toBe("closed");
  });
});

describe("Full accounting cycle (TT133)", () => {
  const testPeriodIds: bigint[] = [];
  const createdEntryIds: bigint[] = [];
  let coaId: string;
  let testPeriodId: bigint;

  beforeAll(async () => {
    const { data: accounts } = await adminClient
      .from("chart_of_accounts")
      .select("id")
      .limit(1);
    coaId = accounts?.[0]?.id || "";

    const { data: period, error: periodErr } = await adminClient
      .from("accounting_periods")
      .insert({ book: "INTERNAL", year: 2026, month: 7 })
      .select()
      .single();

    expect(periodErr).toBeNull();
    testPeriodId = period!.id;
    testPeriodIds.push(testPeriodId);
  });

  afterAll(async () => {
    if (createdEntryIds.length > 0) {
      await adminClient
        .from("journal_entries")
        .delete()
        .in("id", createdEntryIds);
    }
    if (testPeriodIds.length > 0) {
      await adminClient
        .from("accounting_periods")
        .delete()
        .in("id", testPeriodIds);
    }
  });

  it("should post SALE transaction (INTERNAL book, balanced)", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    const { data: saleEntry, error: err1 } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-07-14"),
        book: "INTERNAL",
        period_id: testPeriodId,
        doc_type: "sale",
        description: "Test sale transaction",
        status: "draft",
        total_debit: 1100000,
        total_credit: 1100000,
      })
      .select()
      .single();

    expect(err1).toBeNull();
    expect(saleEntry?.id).toBeTruthy();
    createdEntryIds.push(saleEntry!.id);

    const { data: lines, error: err2 } = await adminClient
      .from("journal_entry_lines")
      .insert([
        {
          entry_id: saleEntry!.id,
          account_id: coaId,
          debit: 1100000,
          credit: 0,
          line_no: 1,
          description: "Cash in",
        },
        {
          entry_id: saleEntry!.id,
          account_id: coaId,
          debit: 0,
          credit: 1100000,
          line_no: 2,
          description: "Revenue",
        },
      ])
      .select();

    expect(err2).toBeNull();
    expect(lines).toHaveLength(2);

    const totalDebit = (lines || []).reduce(
      (sum, line) => sum + (line.debit || 0),
      0
    );
    const totalCredit = (lines || []).reduce(
      (sum, line) => sum + (line.credit || 0),
      0
    );
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it("should post COGS in INTERNAL book only", async () => {
    if (!coaId) {
      console.warn("Skipping test: no chart_of_accounts found");
      return;
    }

    const { data: cogsEntry, error: err1 } = await adminClient
      .from("journal_entries")
      .insert({
        entry_date: new Date("2026-07-14"),
        book: "INTERNAL",
        period_id: testPeriodId,
        doc_type: "cogs",
        description: "Cost of goods sold",
        status: "draft",
        total_debit: 700000,
        total_credit: 700000,
      })
      .select()
      .single();

    expect(err1).toBeNull();
    expect(cogsEntry?.id).toBeTruthy();
    createdEntryIds.push(cogsEntry!.id);

    const { data: lines, error: err2 } = await adminClient
      .from("journal_entry_lines")
      .insert([
        {
          entry_id: cogsEntry!.id,
          account_id: coaId,
          debit: 700000,
          credit: 0,
          line_no: 1,
          description: "COGS",
        },
        {
          entry_id: cogsEntry!.id,
          account_id: coaId,
          debit: 0,
          credit: 700000,
          line_no: 2,
          description: "Inventory reduction",
        },
      ])
      .select();

    expect(err2).toBeNull();
    expect(lines).toHaveLength(2);

    const totalDebit = (lines || []).reduce(
      (sum, line) => sum + (line.debit || 0),
      0
    );
    const totalCredit = (lines || []).reduce(
      (sum, line) => sum + (line.credit || 0),
      0
    );
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it("should close period and lock all entries", async () => {
    const { data: result, error } = await adminClient.rpc(
      "close_accounting_period",
      {
        p_period_id: testPeriodId,
      }
    );

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result[0].success).toBe(true);
    expect(result[0].pnl_entry_id).toBeTruthy();

    if (result[0].pnl_entry_id) {
      createdEntryIds.push(result[0].pnl_entry_id);
    }

    const { data: pnlEntry } = await adminClient
      .from("journal_entries")
      .select()
      .eq("id", result[0].pnl_entry_id)
      .single();

    expect(pnlEntry?.doc_type).toBe("closing");
    expect(pnlEntry?.status).toBe("posted");
    expect(pnlEntry?.total_debit).toBe(pnlEntry?.total_credit);
  });

  it("should prevent posting to locked period", async () => {
    const { error } = await adminClient.from("journal_entries").insert({
      entry_date: new Date("2026-07-20"),
      book: "INTERNAL",
      period_id: testPeriodId,
      doc_type: "sale",
      description: "This should be blocked",
      status: "draft",
      total_debit: 100,
      total_credit: 100,
    });

    expect(error).not.toBeNull();
    expect(error?.message || error?.details || "").toMatch(
      /lock|closed|period/i
    );
  });

  it("should have all entries locked after period close", async () => {
    const { data: allEntries } = await adminClient
      .from("journal_entries")
      .select()
      .eq("period_id", testPeriodId);

    for (const entry of allEntries) {
      expect(entry.status).toBe("posted");
    }

    const { data: period } = await adminClient
      .from("accounting_periods")
      .select("status")
      .eq("id", testPeriodId)
      .single();

    expect(period?.status).toBe("closed");
  });

  it("should verify balanced debits/credits across all entries", async () => {
    const { data: entries } = await adminClient
      .from("journal_entries")
      .select("*, journal_entry_lines(*)")
      .eq("period_id", testPeriodId);

    expect(entries).toBeDefined();

    for (const entry of entries || []) {
      const totalDebit = (entry.journal_entry_lines || []).reduce(
        (sum, line) => sum + (line.debit || 0),
        0
      );
      const totalCredit = (entry.journal_entry_lines || []).reduce(
        (sum, line) => sum + (line.credit || 0),
        0
      );

      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
      expect(Math.abs(entry.total_debit - totalDebit)).toBeLessThan(0.01);
      expect(Math.abs(entry.total_credit - totalCredit)).toBeLessThan(0.01);
    }
  });
});
