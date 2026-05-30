import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// --- HELPER: Caching Token Thông Minh ---
async function getSePayToken(supabase) {
  const { data: config } = await supabase.from('system_settings').select('value').eq('key', 'sepay_config').single();
  const { data: tokenCache } = await supabase.from('system_settings').select('value').eq('key', 'sepay_token').maybeSingle();
  const now = Date.now();
  // Nếu token còn hạn > 1 phút (60000ms), dùng lại cache
  if (tokenCache && tokenCache.value && tokenCache.value.expires_at > now + 60000) {
    return {
      token: tokenCache.value.access_token,
      config: config.value
    };
  }
  // Nếu hết hạn, gọi API cấp mới
  const authStr = btoa(`${config.value.client_id}:${config.value.client_secret}`);
  const res = await fetch('https://einvoice-api.sepay.vn/v1/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authStr}`
    }
  });
  const tokenData = await res.json();
  if (!tokenData.access_token) throw new Error("Không thể lấy Token từ SePay");
  // Lưu Cache vào DB
  await supabase.from('system_settings').upsert({
    key: 'sepay_token',
    value: {
      access_token: tokenData.access_token,
      expires_at: now + tokenData.expires_in * 1000
    },
    updated_at: new Date().toISOString()
  });
  return {
    token: tokenData.access_token,
    config: config.value
  };
}
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { reference_code, order_id } = await req.json();
    if (!reference_code) throw new Error("Thiếu mã hóa đơn nháp (reference_code)");
    const { token } = await getSePayToken(supabase);
    // 1. Bắn lệnh Issue lên SePay
    const issueRes = await fetch('https://einvoice-api.sepay.vn/v1/invoices/issue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference_code
      })
    });
    const issueData = await issueRes.json();
    if (!issueData.success) throw new Error(issueData.error?.message || "Lỗi phát hành SePay");
    const issueTrackingCode = issueData.data.tracking_code;
    // 2. Cập nhật DB trạng thái Pending
    await supabase.from('sales_invoices').update({
      sepay_tracking_code: issueTrackingCode,
      status: 'pending'
    }).eq('sepay_reference_code', reference_code);
    await supabase.from('orders').update({
      invoice_status: 'pending'
    }).eq('id', order_id);
    return new Response(JSON.stringify({
      success: true,
      message: "Đã gửi lệnh CQT"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 400
    });
  }
});
