import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("TIMO_WEBHOOK_SECRET");
if (!WEBHOOK_SECRET) {
  console.error("FATAL: TIMO_WEBHOOK_SECRET env var is not set");
}

serve(async (req) => {
  try {
    // 1. LẤY MÃ BÍ MẬT TỪ CUSTOM HEADER (Thay vì Authorization)
    const clientSecret = req.headers.get("x-timo-secret");
    
    if (clientSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized. Sai mã bí mật." }), { status: 401 });
    }

    // 2. Parse Dữ liệu
    const { amount, memo, transId } = await req.json();

    if (!amount || !memo || !transId) {
      return new Response(JSON.stringify({ error: "Thiếu dữ liệu payload (amount, memo, transId)" }), { status: 400 });
    }

    // 3. Khởi tạo Supabase Admin Client để gọi RPC
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. Gọi DB RPC
    const { data, error } = await supabase.rpc("process_incoming_bank_transfer", {
      p_amount: amount,
      p_memo: memo,
      p_bank_ref_id: transId,
    });

    if (error) throw error;

    return new Response(JSON.stringify(data), { 
        headers: { "Content-Type": "application/json" }, 
        status: 200 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});