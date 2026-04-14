import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

export type PortalRegistrationRequest = {
  id: string;
  business_name: string;
  tax_code: string | null;
  phone: string;
  email: string;
  address: string | null;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  approved_customer_b2b_id: number | null;
  approved_portal_user_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  auth_user_id: string | null;
};

export type CustomerB2BOption = {
  id: number;
  customer_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  tax_code: string | null;
};

export const fetchPortalRegistrations = async (
  status: string = "pending",
): Promise<PortalRegistrationRequest[]> => {
  const { data, error } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown) as PortalRegistrationRequest[];
};

export const searchCustomersB2B = async (
  search: string,
): Promise<CustomerB2BOption[]> => {
  const query = supabase
    .from("customers_b2b")
    .select("id, customer_code, name, phone, email, tax_code")
    .eq("status", "active")
    .limit(20);

  if (search.trim()) {
    query.or(
      `name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as CustomerB2BOption[];
};

export const approvePortalRegistration = async (
  requestId: string,
  existingCustomerId: number | null,
  debtLimit: number = 50000000,
  paymentTerm: number = 30,
): Promise<Record<string, unknown>> => {
  // Step 1: Create auth user via Edge Function (it looks up email/name from request_id)
  const { data: session } = await supabase.auth.getSession();
  const edgeRes = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-registration`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify({ request_id: requestId }),
    },
  );
  const edgeData = await edgeRes.json();
  if (!edgeRes.ok)
    throw new Error(edgeData.error || "Failed to create auth user");

  // Step 2: Call RPC to approve
  const { data, error } = await safeRpc("approve_portal_registration", {
    p_request_id: requestId,
    p_existing_customer_id: existingCustomerId || null,
    p_auth_user_id: edgeData.auth_user_id,
    p_debt_limit: debtLimit,
    p_payment_term: paymentTerm,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
};

export const rejectPortalRegistration = async (
  requestId: string,
  reason: string = "",
): Promise<void> => {
  // Step 1: Fetch request info before updating
  // Note: auth_user_id chưa có trong generated types (cần chạy typegen sau migration)
  const { data: requestRaw } = await supabase
    .from("registration_requests")
    .select("email, business_name")
    .eq("id", requestId)
    .single();
  if (!requestRaw) throw new Error("Request not found");
  const request = requestRaw as { email: string; business_name: string };

  // Step 2: Update status to rejected
  const { error } = await supabase
    .from("registration_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw error;

  // Step 3: Send rejection email (non-blocking)
  try {
    const { data: session } = await supabase.auth.getSession();
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-portal-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          type: "registration_rejected",
          email: request.email,
          data: {
            business_name: request.business_name,
            reason,
          },
        }),
      },
    );
  } catch {
    console.warn("[Portal] Failed to send rejection email for request:", requestId);
  }
};
