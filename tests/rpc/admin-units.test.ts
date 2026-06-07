import { Client } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "../helpers/supabase";

/**
 * Integration tests: ban do hanh chinh VN (mo hinh 2 cap 2025).
 * - Schema/FK: provinces + wards, FK wards.province_code -> provinces.code.
 * - RLS read: service role (adminClient) doc duoc.
 * Deterministic, KHONG phu thuoc seed/mang: chi assert tren row test tu insert.
 */

// Local Supabase DB config (well-known demo)
const DB_CONFIG = {
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
};

// Ma test rieng biet, khong dung cham du lieu seed thuc
const TEST_PROVINCE_CODE = "TEST_P";
const TEST_WARD_CODE = "TEST_W";
const NONEXISTENT_PROVINCE_CODE = "TEST_NOPE";

let pg: Client;

beforeAll(async () => {
  pg = new Client(DB_CONFIG);
  await pg.connect();
  // Cleanup truoc cho idempotent (xa truoc tinh vi FK)
  await pg.query(`DELETE FROM public.wards WHERE code IN ($1)`, [
    TEST_WARD_CODE,
  ]);
  await pg.query(`DELETE FROM public.provinces WHERE code IN ($1)`, [
    TEST_PROVINCE_CODE,
  ]);
});

afterAll(async () => {
  if (pg) {
    await pg.query(`DELETE FROM public.wards WHERE code IN ($1)`, [
      TEST_WARD_CODE,
    ]);
    await pg.query(`DELETE FROM public.provinces WHERE code IN ($1)`, [
      TEST_PROVINCE_CODE,
    ]);
    await pg.end();
  }
});

describe("ban do hanh chinh 2 cap: provinces + wards", () => {
  it("insert province + ward hop le thanh cong", async () => {
    const { rows: prov } = await pg.query(
      `INSERT INTO public.provinces (code, name, full_name, code_name)
       VALUES ($1, $2, $3, $4)
       RETURNING code, name`,
      [TEST_PROVINCE_CODE, "Tinh Test", "Tinh Test Full", "tinh_test"]
    );
    expect(prov[0].code).toBe(TEST_PROVINCE_CODE);

    const { rows: ward } = await pg.query(
      `INSERT INTO public.wards (code, name, full_name, code_name, province_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING code, province_code`,
      [TEST_WARD_CODE, "Xa Test", "Xa Test Full", "xa_test", TEST_PROVINCE_CODE]
    );
    expect(ward[0].code).toBe(TEST_WARD_CODE);
    expect(ward[0].province_code).toBe(TEST_PROVINCE_CODE);
  });

  it("FK chan insert ward voi province_code khong ton tai", async () => {
    await expect(
      pg.query(
        `INSERT INTO public.wards (code, name, province_code)
         VALUES ($1, $2, $3)`,
        ["TEST_W_BAD", "Xa Mo Coi", NONEXISTENT_PROVINCE_CODE]
      )
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("RLS read: service role doc duoc provinces + ward test vua insert", async () => {
    const { data: provData, error: provErr } = await adminClient
      .from("provinces")
      .select("code, name")
      .eq("code", TEST_PROVINCE_CODE)
      .maybeSingle();
    expect(provErr).toBeNull();
    expect(provData).toBeTruthy();
    expect(provData!.code).toBe(TEST_PROVINCE_CODE);

    const { data: wardData, error: wardErr } = await adminClient
      .from("wards")
      .select("code, province_code")
      .eq("code", TEST_WARD_CODE)
      .maybeSingle();
    expect(wardErr).toBeNull();
    expect(wardData).toBeTruthy();
    expect(wardData!.province_code).toBe(TEST_PROVINCE_CODE);
  });

  it("query count khong loi (assert >= row test vua insert, khong phu thuoc seed)", async () => {
    const { count: provCount, error: provErr } = await adminClient
      .from("provinces")
      .select("*", { count: "exact", head: true });
    expect(provErr).toBeNull();
    expect(provCount ?? 0).toBeGreaterThanOrEqual(1);

    const { count: wardCount, error: wardErr } = await adminClient
      .from("wards")
      .select("*", { count: "exact", head: true });
    expect(wardErr).toBeNull();
    expect(wardCount ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("hardening: authenticated/anon CHỈ có SELECT (đã REVOKE ghi/TRUNCATE) trên provinces & wards", async () => {
    const { rows } = await pg.query(
      `SELECT table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name IN ('provinces','wards')
         AND grantee IN ('authenticated','anon')
       ORDER BY table_name, grantee, privilege_type`
    );
    const writePrivs = rows.filter((r) =>
      ["INSERT", "UPDATE", "DELETE", "TRUNCATE"].includes(r.privilege_type)
    );
    // KHÔNG còn quyền ghi nào cho authenticated/anon
    expect(writePrivs).toHaveLength(0);
    // Vẫn còn SELECT (lookup read-all)
    const selects = rows.filter((r) => r.privilege_type === "SELECT");
    expect(selects.length).toBeGreaterThan(0);
  });
});
