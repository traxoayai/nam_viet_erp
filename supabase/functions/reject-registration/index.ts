import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Invalid token",
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
    const { request_id, reason } = await req.json();
    if (!request_id) {
      return new Response(
        JSON.stringify({
          error: "request_id is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const { data: request, error: fetchError } = await supabase
      .from("registration_requests")
      .select("id, email, business_name, auth_user_id, status")
      .eq("id", request_id)
      .single();
    if (fetchError || !request) {
      return new Response(
        JSON.stringify({
          error: "Registration request not found",
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
    if (request.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Yêu cầu đã ở trạng thái "${request.status}", không thể từ chối.`,
        }),
        {
          status: 409,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const { error: updateError } = await supabase
      .from("registration_requests")
      .update({
        status: "rejected",
        rejection_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);
    if (updateError) {
      return new Response(
        JSON.stringify({
          error: `Không thể cập nhật trạng thái: ${updateError.message}`,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    let authDeleted = false;
    let authDeleteError = null;
    if (request.auth_user_id) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        request.auth_user_id
      );
      if (deleteError) {
        authDeleteError = deleteError.message;
        console.error("[reject-registration] deleteUser failed:", deleteError);
      } else {
        authDeleted = true;
      }
    }
    try {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-portal-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            type: "registration_rejected",
            email: request.email,
            data: {
              business_name: request.business_name,
              reason: reason || undefined,
            },
          }),
        }
      );
    } catch (mailErr) {
      console.warn("[reject-registration] send email failed:", mailErr);
    }
    return new Response(
      JSON.stringify({
        success: true,
        auth_deleted: authDeleted,
        auth_delete_error: authDeleteError,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("reject-registration error:", err);
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
