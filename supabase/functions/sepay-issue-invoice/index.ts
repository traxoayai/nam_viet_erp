import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
// Roles được phép phát hành HĐ VAT lên CQT (irreversible — siết chặt)
const ALLOWED_ROLES = ["cashier", "accountant", "admin", "superadmin"];
// --- HELPER: Caching Token Thông Minh ---
async function getSePayToken(supabase) {
  const { data: config } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "sepay_config")
    .single();
  const { data: tokenCache } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "sepay_token")
    .maybeSingle();
  const now = Date.now();
  // Nếu token còn hạn > 1 phút (60000ms), dùng lại cache
  if (
    tokenCache &&
    tokenCache.value &&
    tokenCache.value.expires_at > now + 60000
  ) {
    return {
      token: tokenCache.value.access_token,
      config: config.value,
    };
  }
  // Nếu hết hạn, gọi API cấp mới
  const authStr = btoa(
    `${config.value.client_id}:${config.value.client_secret}`
  );
  const res = await fetch("https://einvoice-api.sepay.vn/v1/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authStr}`,
    },
  });
  const tokenData = await res.json();
  if (!tokenData.access_token) throw new Error("Không thể lấy Token từ SePay");
  // Lưu Cache vào DB
  await supabase.from("system_settings").upsert({
    key: "sepay_token",
    value: {
      access_token: tokenData.access_token,
      expires_at: now + tokenData.expires_in * 1000,
    },
    updated_at: new Date().toISOString(),
  });
  return {
    token: tokenData.access_token,
    config: config.value,
  };
}
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", {
      headers: corsHeaders,
    });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);
    // === SECURITY GATE: Verify caller JWT + role + ownership trước khi gọi SePay ===
    // 1. Auth — bắt buộc có Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const {
      data: { user: caller },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !caller) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized — JWT không hợp lệ",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const { reference_code, order_id } = await req.json();
    if (!reference_code)
      throw new Error("Thiếu mã hóa đơn nháp (reference_code)");
    if (!order_id) throw new Error("Thiếu order_id");
    // 2. Role check — chỉ cashier/accountant/admin được phát hành HĐ VAT
    const { data: callerRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("branch_id, roles ( name )")
      .eq("user_id", caller.id);
    if (rolesError)
      throw new Error(`Không đọc được role: ${rolesError.message}`);
    const roleNames = (callerRoles ?? []).map((r) =>
      (r.roles?.name ?? "").toLowerCase()
    );
    const hasAllowedRole = roleNames.some((n) => ALLOWED_ROLES.includes(n));
    if (!hasAllowedRole) {
      console.warn(
        JSON.stringify({
          event: "sepay_issue_forbidden_role",
          caller_id: caller.id,
          roles: roleNames,
          reference_code,
          order_id,
        })
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden — bạn không có quyền phát hành hóa đơn VAT",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const callerBranchIds = (callerRoles ?? [])
      .map((r) => r.branch_id)
      .filter((id) => id !== null && id !== undefined);
    // 3. Ownership check — order phải tồn tại và caller phải là creator HOẶC cùng chi nhánh
    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .select("id, creator_id, warehouse_id")
      .eq("id", order_id)
      .maybeSingle();
    if (orderError)
      throw new Error(`Không đọc được order: ${orderError.message}`);
    if (!orderRow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order không tồn tại",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const isOwner = orderRow.creator_id === caller.id;
    const isSameBranch =
      orderRow.warehouse_id !== null &&
      callerBranchIds.includes(orderRow.warehouse_id);
    const isAdminLike = roleNames.some(
      (n) => n === "admin" || n === "superadmin"
    );
    if (!isOwner && !isSameBranch && !isAdminLike) {
      console.warn(
        JSON.stringify({
          event: "sepay_issue_forbidden_ownership",
          caller_id: caller.id,
          order_id,
          order_creator: orderRow.creator_id,
          order_branch: orderRow.warehouse_id,
          caller_branches: callerBranchIds,
        })
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden — order không thuộc phạm vi của bạn",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // 4. Reference code phải thuộc order_id này (chống thay đổi reference_code cross-order)
    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("sales_invoices")
      .select("id, order_id")
      .eq("sepay_reference_code", reference_code)
      .maybeSingle();
    if (invoiceError)
      throw new Error(`Không đọc được sales_invoices: ${invoiceError.message}`);
    if (!invoiceRow || invoiceRow.order_id !== order_id) {
      console.warn(
        JSON.stringify({
          event: "sepay_issue_reference_mismatch",
          caller_id: caller.id,
          reference_code,
          order_id,
          invoice_order_id: invoiceRow?.order_id ?? null,
        })
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "reference_code không khớp order_id",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Audit: đã pass mọi gate, sắp gọi CQT
    console.log(
      JSON.stringify({
        event: "sepay_issue_invoice_start",
        caller_id: caller.id,
        caller_roles: roleNames,
        reference_code,
        order_id,
      })
    );
    const { token } = await getSePayToken(supabase);
    // 5. Bắn lệnh Issue lên SePay
    const issueRes = await fetch(
      "https://einvoice-api.sepay.vn/v1/invoices/issue",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference_code,
        }),
      }
    );
    const issueData = await issueRes.json();
    if (!issueData.success)
      throw new Error(issueData.error?.message || "Lỗi phát hành SePay");
    const issueTrackingCode = issueData.data.tracking_code;
    // 6. Cập nhật DB trạng thái Pending
    await supabase
      .from("sales_invoices")
      .update({
        sepay_tracking_code: issueTrackingCode,
        status: "pending",
      })
      .eq("sepay_reference_code", reference_code);
    await supabase
      .from("orders")
      .update({
        invoice_status: "pending",
      })
      .eq("id", order_id);
    // Audit: ghi nhận đã issue thành công
    console.log(
      JSON.stringify({
        event: "sepay_issue_invoice_done",
        caller_id: caller.id,
        reference_code,
        order_id,
        tracking_code: issueTrackingCode,
      })
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: "Đã gửi lệnh CQT",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});
