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
    let searchTerm = url.searchParams.get("q") || "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.searchTerm) {
        searchTerm = body.searchTerm;
      }
    }

    let rows = [];

    if (!searchTerm || searchTerm.trim() === "") {
      rows = await sql`
        SELECT po.id, po.code, po.supplier_id, po.shipping_partner_id, po.status, po.delivery_status,
               po.payment_status, po.total_amount, po.final_amount, po.total_paid, po.created_at,
               s.name AS supplier_name,
               sp.name AS shipping_partner_name,
               u.full_name AS creator_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN shipping_partners sp ON po.shipping_partner_id = sp.id
        LEFT JOIN users u ON po.creator_id = u.id
        ORDER BY po.created_at DESC
        LIMIT 200
      `;
    } else {
      const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
      
      const conditions = words.map(word => {
        const pattern = `%${word}%`;
        return sql`(unaccent(s.name) ILIKE unaccent(${pattern}) OR unaccent(p.name) ILIKE unaccent(${pattern}) OR po.code ILIKE ${pattern})`;
      });

      const combinedCondition = conditions.reduce((acc, curr) => sql`${acc} AND ${curr}`);

      rows = await sql`
        SELECT po.id, po.code, po.supplier_id, po.shipping_partner_id, po.status, po.delivery_status,
               po.payment_status, po.total_amount, po.final_amount, po.total_paid, po.created_at,
               s.name AS supplier_name,
               sp.name AS shipping_partner_name,
               u.full_name AS creator_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN shipping_partners sp ON po.shipping_partner_id = sp.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
        LEFT JOIN products p ON poi.product_id = p.id
        LEFT JOIN users u ON po.creator_id = u.id
        WHERE ${combinedCondition}
        GROUP BY po.id, po.code, po.supplier_id, po.shipping_partner_id, po.status, po.delivery_status,
                 po.payment_status, po.total_amount, po.final_amount, po.total_paid, po.created_at,
                 s.name, sp.name, u.full_name
        ORDER BY po.created_at DESC
        LIMIT 200
      `;
    }

    const formattedData = rows.map(row => ({
      id: row.id,
      code: row.code,
      supplier_id: row.supplier_id,
      shipping_partner_id: row.shipping_partner_id,
      status: row.status,
      delivery_status: row.delivery_status,
      payment_status: row.payment_status,
      total_amount: row.total_amount,
      final_amount: row.final_amount,
      total_paid: row.total_paid,
      created_at: row.created_at,
      creator_name: row.creator_name,
      suppliers: { name: row.supplier_name },
      shipping_partners: { name: row.shipping_partner_name }
    }));

    return new Response(JSON.stringify({ data: formattedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error searching purchase orders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
