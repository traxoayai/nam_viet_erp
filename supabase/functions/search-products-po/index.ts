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
    let searchTerm = url.searchParams.get("q") || "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.searchTerm) {
        searchTerm = body.searchTerm;
      }
    }

    let rows = [];

    // Query lấy thông tin SP + Tồn Kho (Kho 1) + Đơn vị sỉ + Số bán TB
    // Chúng ta lấy đơn vị sỉ bằng cách lấy unit có conversion_rate lớn nhất (hoặc lớn hơn 1)
    if (!searchTerm || searchTerm.trim() === "") {
      rows = await sql`
        SELECT 
          p.id, p.name, p.sku, p.image_url,
          COALESCE(pi.stock_quantity, 0) AS stock_quantity,
          COALESCE(pi.max_stock, 0) AS max_stock,
          COALESCE(ms.monthly_sales_qty, 0) AS monthly_sales_qty,
          (
            SELECT jsonb_build_object(
              'unit_name', pu.unit_name,
              'conversion_rate', pu.conversion_rate,
              'price', pu.price,
              'price_cost', pu.price_cost
            )
            FROM product_units pu 
            WHERE pu.product_id = p.id AND pu.conversion_rate > 1
            ORDER BY pu.conversion_rate DESC LIMIT 1
          ) AS wholesale_unit
        FROM products p
        LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.warehouse_id = 1
        LEFT JOIN product_monthly_sales_view ms ON p.id = ms.product_id
        WHERE p.status = 'active'
        ORDER BY p.id DESC
        LIMIT 50
      `;
    } else {
      const pattern = `%${searchTerm.trim()}%`;
      rows = await sql`
        SELECT 
          p.id, p.name, p.sku, p.image_url,
          COALESCE(pi.stock_quantity, 0) AS stock_quantity,
          COALESCE(pi.max_stock, 0) AS max_stock,
          COALESCE(ms.monthly_sales_qty, 0) AS monthly_sales_qty,
          (
            SELECT jsonb_build_object(
              'unit_name', pu.unit_name,
              'conversion_rate', pu.conversion_rate,
              'price', pu.price,
              'price_cost', pu.price_cost
            )
            FROM product_units pu 
            WHERE pu.product_id = p.id AND pu.conversion_rate > 1
            ORDER BY pu.conversion_rate DESC LIMIT 1
          ) AS wholesale_unit
        FROM products p
        LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.warehouse_id = 1
        LEFT JOIN product_monthly_sales_view ms ON p.id = ms.product_id
        WHERE p.status = 'active'
          AND (unaccent(p.name) ILIKE unaccent(${pattern}) OR p.sku ILIKE ${pattern} OR p.barcode ILIKE ${pattern})
        ORDER BY p.id DESC
        LIMIT 50
      `;
    }

    return new Response(JSON.stringify({ data: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error searching products po:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
