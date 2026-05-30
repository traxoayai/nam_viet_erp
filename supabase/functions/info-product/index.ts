import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs/mod.js";

// Lấy chuỗi kết nối từ biến môi trường
const connectionString =
  Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cấu hình pooler của postgres.js (chỉ khởi tạo khi có connection string)
const sql = connectionString
  ? postgres(connectionString, {
      max: 5, // Giới hạn max connections cho Edge Function
      idle_timeout: 10, // Đóng kết nối nếu không dùng sau 10s
    })
  : null;

serve(async (req) => {
  // Xử lý preflight CORS
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
    // Lấy product_id từ query parameter hoặc JSON body
    let productId = url.searchParams.get("id");

    if (!productId && req.method === "POST") {
      const body = await req.json();
      productId = body.id || body.product_id;
    }

    if (!productId) {
      return new Response(JSON.stringify({ error: "Missing product id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Thực hiện truy vấn đồng thời 3 bảng để tối ưu thời gian phản hồi
    const [products, productUnits, productInventory] = await Promise.all([
      sql`SELECT * FROM products WHERE id = ${productId}`,
      sql`SELECT * FROM product_units WHERE product_id = ${productId}`,
      sql`SELECT * FROM product_inventory WHERE product_id = ${productId}`,
    ]);

    const product = products.length > 0 ? products[0] : null;

    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gộp toàn bộ thông tin
    const result = {
      ...product,
      units: productUnits,
      inventory: productInventory,
    };

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching product info:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
