import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs/mod.js";

const connectionString = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL") || "postgresql://postgres.iudkexocalqdhxuyjacu:Longlong123%40a@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

const sql = postgres(connectionString, {
  max: 5,           
  idle_timeout: 10, 
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let partnerId = url.searchParams.get("id") || url.searchParams.get("partner_id");
    
    if (!partnerId && req.method === "POST") {
      const body = await req.json();
      partnerId = body.id || body.partner_id;
    }

    if (!partnerId) {
      return new Response(JSON.stringify({ error: "Missing partner id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const partners = await sql`SELECT * FROM shipping_partners WHERE id = ${partnerId}`;
    const partner = partners.length > 0 ? partners[0] : null;

    if (!partner) {
      return new Response(JSON.stringify({ error: "Shipping partner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: partner }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error fetching shipping partner info:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
