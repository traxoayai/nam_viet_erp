import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
serve(async ()=>{
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);
    // 1. Tìm các Hóa đơn đang chờ CQT
    const { data: pendingInvoices } = await supabase.from('sales_invoices').select('id, order_id, sepay_tracking_code').eq('status', 'pending').not('sepay_tracking_code', 'is', null);
    if (!pendingInvoices || pendingInvoices.length === 0) {
      return new Response("No pending invoices", {
        status: 200
      });
    }
    const { token } = await getSePayToken(supabase);
    // 2. Check từng hóa đơn
    for (const inv of pendingInvoices){
      const checkRes = await fetch(`https://einvoice-api.sepay.vn/v1/invoices/issue/check/${inv.sepay_tracking_code}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const checkData = await checkRes.json();
      if (checkData.success && checkData.data.status === 'Success') {
        const finalInvoice = checkData.data.invoice;
        // Cập nhật DB: Thành công
        await supabase.from('sales_invoices').update({
          status: 'issued',
          invoice_number: finalInvoice.invoice_number,
          pdf_url: finalInvoice.pdf_url,
          xml_url: finalInvoice.xml_url,
          parsed_data: finalInvoice
        }).eq('id', inv.id);
        await supabase.from('orders').update({
          invoice_status: 'issued'
        }).eq('id', inv.order_id);
        // Lấy creator_id để gửi thông báo
        const { data: orderData } = await supabase.from('orders').select('creator_id, code').eq('id', inv.order_id).single();
        if (orderData?.creator_id) {
          await supabase.from('notifications').insert({
            user_id: orderData.creator_id,
            title: "Xuất VAT Thành Công ✅",
            message: `Hóa đơn số ${finalInvoice.invoice_number} cho đơn ${orderData.code} đã được cấp.`,
            type: "success"
          });
        }
      } else if (checkData.success && checkData.data.status === 'Failed') {
        // Cập nhật DB: Thất bại
        await supabase.from('sales_invoices').update({
          status: 'rejected',
          note: checkData.data.message
        }).eq('id', inv.id);
        await supabase.from('orders').update({
          invoice_status: 'none'
        }).eq('id', inv.order_id);
      }
    }
    return new Response("Synced", {
      status: 200
    });
  } catch (error) {
    return new Response(error.message, {
      status: 500
    });
  }
});
