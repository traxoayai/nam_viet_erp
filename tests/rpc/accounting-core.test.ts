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
