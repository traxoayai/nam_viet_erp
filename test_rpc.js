import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://mhwkavmswxxzavxeygce.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.log("No VITE_SUPABASE_ANON_KEY found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Try to find the latest PO ID
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, receipt_draft")
    .order("id", { ascending: false })
    .limit(1);
  if (!pos || pos.length === 0) {
    console.log("No PO found");
    return;
  }
  const poId = pos[0].id;
  console.log("Testing with PO ID:", poId);
  console.log("Direct select receipt_draft:", pos[0].receipt_draft);

  const { data, error } = await supabase.rpc("get_purchase_order_detail", {
    p_po_id: poId,
  });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Result Keys:", Object.keys(data || {}));
    console.log("Has receipt_draft:", !!data?.receipt_draft);
  }
}
test();
