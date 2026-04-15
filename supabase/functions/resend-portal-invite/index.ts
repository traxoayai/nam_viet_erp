import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PortalEmailType = "portal_user_invite" | "portal_user_reset_password";

async function sendPortalEmail(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  emailType: PortalEmailType;
  email: string;
  actionLink: string;
  displayName: string;
}) {
  const { supabaseUrl, serviceRoleKey, emailType, email, actionLink, displayName } = params;
  const response = await fetch(`${supabaseUrl}/functions/v1/send-portal-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: emailType,
      email,
      data: {
        action_link: actionLink,
        display_name: displayName,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error || `send-portal-email failed with status ${response.status}`;
    throw new Error(message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const portalUrl = Deno.env.get("PORTAL_SITE_URL") ?? "https://nam-viet-b2b.vercel.app";
    const redirectTo = `${portalUrl.replace(/\/$/, "")}/auth/callback`;

    // Fix action_link redirect_to to point to Portal site (Supabase Auth may override with Site URL)
    function fixActionLink(link: string): string {
      const url = new URL(link);
      url.searchParams.set("redirect_to", redirectTo);
      return url.toString();
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { display_name: email },
        redirectTo,
      },
    });

    if (!inviteError && inviteData.properties.action_link) {
      await sendPortalEmail({
        supabaseUrl,
        serviceRoleKey,
        emailType: "portal_user_invite",
        email,
        actionLink: fixActionLink(inviteData.properties.action_link),
        displayName: email,
      });
      return new Response(
        JSON.stringify({
          action: "invite",
          message: "Đã gửi lại email mời đặt mật khẩu.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });
    if (recoveryError || !recoveryData.properties.action_link) {
      return new Response(JSON.stringify({ error: recoveryError?.message || "Cannot generate recovery link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendPortalEmail({
      supabaseUrl,
      serviceRoleKey,
      emailType: "portal_user_reset_password",
      email,
      actionLink: fixActionLink(recoveryData.properties.action_link),
      displayName: email,
    });

    return new Response(
      JSON.stringify({
        action: "recovery",
        message: "Đã gửi email đặt lại mật khẩu.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("resend-portal-invite error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
