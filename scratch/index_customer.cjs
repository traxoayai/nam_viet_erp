const postgres = require('postgres');

const sql = postgres("postgresql://postgres.iudkexocalqdhxuyjacu:Longlong123%40a@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres");

async function run() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log('Extension pg_trgm created');

    await sql`CREATE INDEX IF NOT EXISTS idx_customers_b2b_name_trgm ON customers_b2b USING gin (name gin_trgm_ops)`;
    console.log('Index name created');

    await sql`CREATE INDEX IF NOT EXISTS idx_customers_b2b_phone_trgm ON customers_b2b USING gin (phone gin_trgm_ops)`;
    console.log('Index phone created');

    await sql`CREATE INDEX IF NOT EXISTS idx_customers_b2b_tax_code_trgm ON customers_b2b USING gin (tax_code gin_trgm_ops)`;
    console.log('Index tax_code created');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
