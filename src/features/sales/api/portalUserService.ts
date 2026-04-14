import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

export type PortalUserRow = {
  id: string;
  auth_user_id: string;
  customer_b2b_id: number;
  display_name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  customer_name: string;
  customer_code: string;
};

export const fetchPortalUsers = async (
  search?: string,
  status?: string,
): Promise<PortalUserRow[]> => {
  const { data, error } = await safeRpc("get_portal_users_list", {
    p_search: search || null,
    p_status: status || null,
  });
  if (error) throw error;
  return (data ?? []) as PortalUserRow[];
};

type CreatePortalUserParams = {
  customerB2bId: number;
  email: string;
  displayName?: string;
  phone?: string;
  role?: string;
};

export const createPortalUserFromERP = async (
  params: CreatePortalUserParams,
): Promise<{ portalUserId: string }> => {
  const { customerB2bId, email, displayName, phone, role } = params;

  // Step 1: Create auth user via Edge Function
  const { data: session } = await supabase.auth.getSession();
  const edgeRes = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify({
        email,
        display_name: displayName || null,
      }),
    },
  );
  const edgeData = await edgeRes.json();
  if (!edgeRes.ok)
    throw new Error(edgeData.error || "Failed to create portal auth user");

  // Step 2: Create portal user record via RPC
  const { data, error } = await safeRpc("create_portal_user_from_erp", {
    p_auth_user_id: edgeData.auth_user_id,
    p_customer_b2b_id: customerB2bId,
    p_email: email,
    p_display_name: displayName || null,
    p_phone: phone || null,
    p_role: role || "staff",
  });
  if (error) throw error;

  const result = data as Record<string, unknown>;
  return { portalUserId: result.portal_user_id as string };
};

export const togglePortalUserStatus = async (
  portalUserId: string,
  newStatus: "active" | "inactive",
): Promise<void> => {
  const { error } = await safeRpc("toggle_portal_user_status", {
    p_portal_user_id: portalUserId,
    p_new_status: newStatus,
  });
  if (error) throw error;
};

type CreateCustomerB2BParams = {
  name: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  vatAddress?: string;
  shippingAddress?: string;
  debtLimit?: number;
  paymentTerm?: number;
};

export const createCustomerB2BInline = async (
  params: CreateCustomerB2BParams,
): Promise<number> => {
  const {
    name,
    taxCode,
    phone,
    email,
    vatAddress,
    shippingAddress,
    debtLimit,
    paymentTerm,
  } = params;

  // Generate customer code: query max id, format as B2B-XXXXX
  const { data: maxRow, error: maxError } = await supabase
    .from("customers_b2b")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (maxError && maxError.code !== "PGRST116") throw maxError;

  const nextId = (maxRow?.id ?? 0) + 1;
  const customerCode = `B2B-${String(nextId).padStart(5, "0")}`;

  const { data, error } = await supabase
    .from("customers_b2b")
    .insert({
      customer_code: customerCode,
      name,
      tax_code: taxCode || null,
      phone: phone || null,
      email: email || null,
      vat_address: vatAddress || null,
      shipping_address: shippingAddress || null,
      debt_limit: debtLimit ?? 50000000,
      payment_term: paymentTerm ?? 30,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};
