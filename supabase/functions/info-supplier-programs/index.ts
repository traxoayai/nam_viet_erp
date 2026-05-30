import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs/mod.js";

const connectionString =
  Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const sql = connectionString
  ? postgres(connectionString, {
      max: 5,
      idle_timeout: 10,
    })
  : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!sql) {
    return new Response(
      JSON.stringify({
        error:
          "Database connection not configured (SUPABASE_DB_URL or DATABASE_URL missing)",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    const url = new URL(req.url);
    let supplierId =
      url.searchParams.get("id") || url.searchParams.get("supplier_id");

    if (!supplierId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      supplierId = body.id || body.supplier_id;
    }

    if (!supplierId) {
      return new Response(JSON.stringify({ error: "Missing supplier id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const programs = await sql`
      SELECT * FROM supplier_programs 
      WHERE supplier_id = ${supplierId} 
        AND status = 'active'
        AND valid_to >= CURRENT_DATE
      ORDER BY valid_to DESC
    `;

    return new Response(JSON.stringify({ data: programs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching supplier programs:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
