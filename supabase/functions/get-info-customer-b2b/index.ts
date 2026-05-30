import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs/mod.js";

const connectionString =
  Deno.env.get("SUPABASE_DB_URL") ||
  Deno.env.get("DATABASE_URL") ||
  "postgresql://postgres.iudkexocalqdhxuyjacu:Longlong123%40a@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 10,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let customerIdStr =
      url.searchParams.get("id") || url.searchParams.get("customer_id");

    if (!customerIdStr && req.method === "POST") {
      const body = await req.json();
      customerIdStr = body.id || body.customer_id;
    }

    if (!customerIdStr) {
      return new Response(JSON.stringify({ error: "Missing customer id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = parseInt(customerIdStr, 10);
    if (isNaN(customerId)) {
      return new Response(JSON.stringify({ error: "Invalid customer id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get business info from customers_b2b
    const customers =
      await sql`SELECT * FROM customers_b2b WHERE id = ${customerId}`;
    const customer = customers.length > 0 ? customers[0] : null;

    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get debt info from b2b_customer_debt_view
    const debts =
      await sql`SELECT actual_current_debt FROM b2b_customer_debt_view WHERE customer_id = ${customerId}`;
    const debtInfo = debts.length > 0 ? debts[0] : null;

    // 3. Get contacts from customer_b2b_contacts
    const contacts =
      await sql`SELECT * FROM customer_b2b_contacts WHERE customer_b2b_id = ${customerId}`;

    // Formatting Response
    const data = {
      customer: {
        id: customer.id,
        name: customer.name,
        tax_code: customer.tax_code,
        shipping_address: customer.shipping_address,
        debt_limit: customer.debt_limit,
      },
      debt: {
        actual_current_debt: debtInfo ? debtInfo.actual_current_debt : 0,
      },
      contacts: contacts,
    };

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching customer b2b info:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
