import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

import { buildHtmlEmail } from "./templates.ts";
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
    // Auth: accept service_role key or authenticated admin JWT
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
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // If not service_role key, verify as JWT
    if (token !== serviceRoleKey) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL"),
        serviceRoleKey
      );
      const { error: authError } = await supabase.auth.getUser(token);
      if (authError) {
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
    }
    // Parse & validate input
    const { type, email, data } = await req.json();
    if (!type || !email) {
      return new Response(
        JSON.stringify({
          error: "type and email are required",
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
    const validTypes = [
      "registration_received",
      "registration_approved",
      "registration_rejected",
      "admin_new_registration",
      "admin_new_order",
      "admin_payment_received",
      "portal_user_invite",
      "portal_user_reset_password",
      "payment_reminder",
      "payment_received_customer",
      "payment_received_internal",
    ];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
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
    // Build email content
    const { subject, html } = buildHtmlEmail(type, data || {});
    // Gmail SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;
    if (!smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({
          error: "SMTP configuration is incomplete (SMTP_USER/SMTP_PASSWORD)",
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
    // Send email via Gmail SMTP (nodemailer)
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject,
      html,
    });
    return new Response(
      JSON.stringify({
        success: true,
        message: `Email "${type}" sent to ${email}`,
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
    console.error("send-portal-email error:", err);
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
