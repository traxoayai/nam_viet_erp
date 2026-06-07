// Seed ban do hanh chinh VN (mo hinh 2 cap 2025: tinh + xa, bo huyen) tu dataset cong khai.
// Idempotent: INSERT ... ON CONFLICT (code) DO UPDATE.
// Chay: NODE_PATH="<repo>/node_modules" node scripts/seed-admin-units.mjs
// Ngay 2026-06-08.
import pg from "pg";

const { Client } = pg;
const CONN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DATASET_URL =
  "https://raw.githubusercontent.com/ThangLeQuoc/vietnamese-provinces-database/master/json/simplified_json_generated_data_vn_units.json";
const WARD_BATCH = 500;

async function main() {
  console.log("Fetching dataset:", DATASET_URL);
  let provincesData;
  try {
    const res = await fetch(DATASET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    provincesData = await res.json();
  } catch (e) {
    console.error("BLOCKED: fetch dataset that bai:", e.message);
    process.exit(2);
  }
  if (!Array.isArray(provincesData) || provincesData.length === 0) {
    console.error("BLOCKED: dataset rong hoac sai dinh dang.");
    process.exit(2);
  }
  console.log(`Fetched ${provincesData.length} provinces.`);

  const client = new Client({ connectionString: CONN });
  await client.connect();
  try {
    // ── Upsert provinces ───────────────────────────────────────────────
    for (const p of provincesData) {
      await client.query(
        `INSERT INTO public.provinces (code, name, full_name, code_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name,
               full_name = EXCLUDED.full_name,
               code_name = EXCLUDED.code_name`,
        [p.Code, p.Name, p.FullName ?? null, p.CodeName ?? null]
      );
    }
    console.log(`Upserted ${provincesData.length} provinces.`);

    // ── Gom toan bo wards ──────────────────────────────────────────────
    const wards = [];
    for (const p of provincesData) {
      for (const w of p.Wards ?? []) {
        wards.push({
          code: w.Code,
          name: w.Name,
          full_name: w.FullName ?? null,
          code_name: w.CodeName ?? null,
          province_code: w.ProvinceCode ?? p.Code,
        });
      }
    }
    console.log(`Total wards to upsert: ${wards.length}`);

    // ── Upsert wards theo batch ────────────────────────────────────────
    for (let i = 0; i < wards.length; i += WARD_BATCH) {
      const batch = wards.slice(i, i + WARD_BATCH);
      const values = [];
      const params = [];
      batch.forEach((w, idx) => {
        const b = idx * 5;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
        params.push(w.code, w.name, w.full_name, w.code_name, w.province_code);
      });
      await client.query(
        `INSERT INTO public.wards (code, name, full_name, code_name, province_code)
         VALUES ${values.join(", ")}
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name,
               full_name = EXCLUDED.full_name,
               code_name = EXCLUDED.code_name,
               province_code = EXCLUDED.province_code`,
        params
      );
    }
    console.log(`Upserted ${wards.length} wards (batch=${WARD_BATCH}).`);

    // ── Verify counts ──────────────────────────────────────────────────
    const provCount = await client.query("SELECT count(*)::int AS c FROM public.provinces");
    const wardCount = await client.query("SELECT count(*)::int AS c FROM public.wards");
    console.log("─────────────────────────────────────");
    console.log(`provinces count: ${provCount.rows[0].c} (ky vong ~34)`);
    console.log(`wards count:     ${wardCount.rows[0].c} (ky vong ~3321)`);
    console.log("─────────────────────────────────────");

    await client.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("SEED FAIL:", e.message);
  process.exit(1);
});
