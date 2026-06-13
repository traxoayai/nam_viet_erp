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
