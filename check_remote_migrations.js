import pkg from "pg";
const { Client } = pkg;
import fs from "fs";
import path from "path";

async function checkMigrations() {
  // Connection string đọc từ env — KHÔNG hardcode secret (xem CLAUDE.md).
  // Ví dụ: export SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@<host>:6543/postgres"
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "❌ Thiếu env SUPABASE_DB_URL (hoặc DATABASE_URL). Set connection string Postgres rồi chạy lại."
    );
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();

    // 1. Get applied migrations
    const res = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC"
    );
    const appliedVersions = res.rows.map((r) => r.version);
    console.log(`Remote DB has ${appliedVersions.length} migrations applied.`);

    // 2. Get local migrations
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"));
    const localVersions = files.map((f) => f.split("_")[0]);
    console.log(`Local VS Code has ${localVersions.length} migrations.`);

    // 3. Compare
    const missingOnRemote = localVersions.filter(
      (v) => !appliedVersions.includes(v)
    );
    const extraOnRemote = appliedVersions.filter(
      (v) => !localVersions.includes(v)
    );

    if (missingOnRemote.length > 0) {
      console.log("\n❌ Migrations present locally but NOT on Remote DB:");
      missingOnRemote.forEach((v) => console.log(`  - ${v}`));
    } else {
      console.log("\n✅ All local migrations have been applied to Remote DB.");
    }

    if (extraOnRemote.length > 0) {
      console.log("\n⚠️ Migrations present on Remote DB but NOT locally:");
      extraOnRemote.forEach((v) => console.log(`  - ${v}`));
    } else {
      console.log("\n✅ No extra migrations on Remote DB.");
    }
  } catch (err) {
    console.error("Error checking migrations:", err);
  } finally {
    await client.end();
  }
}

checkMigrations();
