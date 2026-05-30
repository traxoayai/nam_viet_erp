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
    const { orderId, customerInfo, vatItems, orderDiscountAmount = 0 } = await req.json();
    // 1. Lấy Token & Config
    const { token, config } = await getSePayToken(supabase);
    // 2. Mapping Dữ Liệu
    // Payment Mapping
    const mapPayment = (pm)=>{
      const m = (pm || "").toLowerCase();
      if (m.includes("bank") || m.includes("transfer") || m.includes("ck")) return "CK";
      if (m.includes("debt") || m.includes("nợ")) return "KHAC";
      if (m.includes("tm/ck")) return "TM/CK";
      return "TM";
    };
    // Item Mapping (Chiết khấu & Hàng tặng)
    let lineNumber = 1;
    const sepayItems = vatItems.map((item)=>{
      const isGift = item.is_gift || item.price === 0;
      const vatPercent = (item.vat_rate || 0) / 100;
      const netPrice = isGift ? 0 : item.price / (1 + vatPercent);
      return {
        line_number: lineNumber++,
        line_type: isGift ? 2 : 1,
        item_code: item.sku || `SP${item.product_id}`,
        item_name: item.name,
        unit: item.unit || 'Cái',
        quantity: item.vat_qty,
        unit_price: parseFloat(netPrice.toFixed(2)),
        tax_rate: isGift ? 0 : item.vat_rate,
        discount_amount: item.discount || 0
      };
    });
    // Nếu có chiết khấu tổng đơn -> Thêm 1 dòng Line Type 3
    if (orderDiscountAmount > 0) {
      sepayItems.push({
        line_number: lineNumber++,
        line_type: 3,
        item_name: "Chiết khấu thương mại",
        before_discount_and_tax_amount: orderDiscountAmount
      });
    }
    const payload = {
      template_code: config.template_code,
      invoice_series: config.invoice_series,
      issued_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      currency: "VND",
      provider_account_id: config.provider_account_id,
      payment_method: mapPayment(customerInfo.payment_method),
      is_draft: true,
      buyer: {
        type: customerInfo.tax_code?.length >= 10 ? "company" : "personal",
        name: customerInfo.customer_name,
        legal_name: customerInfo.customer_name,
        tax_code: customerInfo.tax_code || "",
        address: customerInfo.address || "",
        email: customerInfo.email || ""
      },
      items: sepayItems,
      notes: "Hóa đơn VAT xuất từ hệ thống Nam Việt"
    };
    // 3. Gửi Request Tạo Nháp
    const createRes = await fetch('https://einvoice-api.sepay.vn/v1/invoices/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error(createData.error?.message || "Lỗi tạo hóa đơn SePay");
    const trackingCode = createData.data.tracking_code;
    // 4. Short-Polling Lấy Reference Code (Delay 1s, thử 3 lần vì Draft thường ra ngay)
    let referenceCode = null;
    let draftDetails = null;
    for(let i = 0; i < 3; i++){
      await new Promise((resolve)=>setTimeout(resolve, 1000)); // Sleep 1s
      const checkRes = await fetch(`https://einvoice-api.sepay.vn/v1/invoices/create/check/${trackingCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const checkData = await checkRes.json();
      if (checkData.success && checkData.data.status === 'Success') {
        referenceCode = checkData.data.reference_code;
        draftDetails = checkData.data.invoice;
        break;
      }
    }
    if (!referenceCode) {
      throw new Error("SePay phản hồi quá chậm. Vui lòng thử lại sau.");
    }
    // 5. Lưu xuống DB trạng thái Nháp
    await supabase.from('sales_invoices').insert({
      order_id: orderId,
      invoice_date: new Date().toISOString(),
      buyer_name: customerInfo.customer_name,
      buyer_tax_code: customerInfo.tax_code,
      status: 'draft',
      sepay_reference_code: referenceCode,
      parsed_data: draftDetails // Lưu lại thông tin PDF/Tiền thuế để FE render
    });
    return new Response(JSON.stringify({
      success: true,
      reference_code: referenceCode,
      invoice: draftDetails
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
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
