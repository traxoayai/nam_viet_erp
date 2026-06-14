import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

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

const PORTAL_URL =
  import.meta.env.VITE_PORTAL_URL ?? "https://nam-viet-b2b.vercel.app";

async function callEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `Edge function "${name}" lỗi`);
  }
  return data as T;
}

export const fetchPortalRegistrations = async (
  status: string = "pending"
): Promise<PortalRegistrationRequest[]> => {
  const { data, error } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as PortalRegistrationRequest[];
};

export const searchCustomersB2B = async (
  search: string
): Promise<CustomerB2BOption[]> => {
  const query = supabase
    .from("customers_b2b")
    .select("id, customer_code, name, phone, email, tax_code")
    .eq("status", "active")
    .limit(20);

  if (search.trim()) {
    query.or(
      `name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
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
  paymentTerm: number = 30
): Promise<Record<string, unknown>> => {
  // Step 1: Lấy auth_user_id từ registration_requests (đã được tạo lúc khách đăng ký)
  const { data: requestRaw, error: fetchError } = await supabase
    .from("registration_requests")
    .select("auth_user_id, email, business_name, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !requestRaw) {
    throw new Error("Không tìm thấy yêu cầu đăng ký");
  }
  const request = requestRaw as unknown as {
    auth_user_id: string | null;
    email: string;
    business_name: string;
    status: string;
  };

  if (request.status !== "pending") {
    throw new Error(
      `Yêu cầu đã ở trạng thái "${request.status}", không thể duyệt.`
    );
  }

  let authUserId = request.auth_user_id;

  // Legacy fallback: request không có auth_user_id → Edge Function sẽ invite tạo mới
  if (!authUserId) {
    const edgeData = await callEdgeFunction<{ auth_user_id: string }>(
      "approve-registration",
      { request_id: requestId, skip_email: true }
    );
    authUserId = edgeData.auth_user_id;
  }

  // Step 2: Gọi RPC để commit dữ liệu TRƯỚC khi gửi mail
  const { data, error } = await safeRpc("approve_portal_registration", {
    p_request_id: requestId,
    p_existing_customer_id: existingCustomerId || null,
    p_auth_user_id: authUserId,
    p_debt_limit: debtLimit,
    p_payment_term: paymentTerm,
  });
  if (error) throw error;

  // Step 3: RPC thành công → gửi mail kích hoạt (non-blocking)
  try {
    await callEdgeFunction("send-portal-email", {
      type: "registration_approved",
      email: request.email,
      data: {
        business_name: request.business_name,
        portal_url: PORTAL_URL,
      },
    });
  } catch (mailErr) {
    console.warn("[Portal] Gửi mail duyệt thất bại:", mailErr);
  }

  return data as Record<string, unknown>;
};

export const rejectPortalRegistration = async (
  requestId: string,
  reason: string = ""
): Promise<void> => {
  await callEdgeFunction("reject-registration", {
    request_id: requestId,
    reason: reason || undefined,
  });
};
