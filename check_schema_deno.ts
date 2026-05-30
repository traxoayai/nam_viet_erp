import postgres from "https://deno.land/x/postgresjs/mod.js";

const sql = postgres("postgresql://postgres.iudkexocalqdhxuyjacu:Longlong123%40a@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres");

async function run() {
  try {
    const debtColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'b2b_customer_debt_view'
    `;
    console.log('b2b_customer_debt_view columns:', debtColumns.map(c => c.column_name));

    const contactColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer_b2b_contacts'
    `;
    console.log('customer_b2b_contacts columns:', contactColumns.map(c => c.column_name));

    Deno.exit(0);
  } catch (err) {
    console.error(err);
    Deno.exit(1);
  }
}

run();
