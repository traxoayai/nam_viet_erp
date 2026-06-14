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
    const sql = fs.readFileSync(
      "supabase/migrations/20260529150700_enable_unaccent.sql",
      "utf8"
    );
    await client.query(sql);
    console.log("Unaccent extension enabled successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
