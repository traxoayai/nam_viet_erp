import pkg from "pg";
const { Client } = pkg;
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
let dbUrl = "";
envFile.split("\n").forEach((line) => {
  if (line.startsWith("DATABASE_URL=")) {
    dbUrl = line.split("=")[1].replace(/"/g, "");
  }
});

const client = new Client({
  connectionString: dbUrl,
});

async function runMigration() {
  try {
    await client.connect();
    const filePath =
      process.argv[2] ||
      "supabase/migrations/20260529140400_add_product_images_to_products.sql";
    const sql = fs.readFileSync(filePath, "utf8");
    await client.query(sql);
    console.log("Migration applied successfully via pg client.");

    // Also record it in supabase_migrations.schema_migrations just in case
    const versionMatch = filePath.match(/(\d{14})/);
    const version = versionMatch ? versionMatch[1] : "unknown";
    try {
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING`
      );
      console.log("Migration history updated.");
    } catch (e) {
      console.log("Could not update migration history:", e.message);
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
