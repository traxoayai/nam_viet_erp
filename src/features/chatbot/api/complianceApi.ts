// API wrappers cho Compliance Audit chatbot (Plan 2 Task 18).
// - listAudits / reviewAudit: thao tác trực tiếp lên bảng
//   `chat_compliance_audits` (RLS đã policy cho role compliance/admin).
// - triggerAuditNow: bọc RPC `audit_chat_messages_daily` qua safeRpc.

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export interface ComplianceAudit {
  id: string;
  message_id: string;
  session_id: string;
  rule_code: string;
  severity: "low" | "medium" | "high";
  matched_keywords: string[];
  excerpt: string;
  status: "open" | "reviewed_ok" | "reviewed_violation";
  audited_at: string;
  reviewer_note: string | null;
}

export async function listAudits(
  status: "open" | "all" = "open"
): Promise<ComplianceAudit[]> {
  let q = supabase
    .from("chat_compliance_audits")
    .select("*")
    .order("audited_at", { ascending: false })
    .limit(200);
  if (status === "open") q = q.eq("status", "open");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ComplianceAudit[];
}

export async function reviewAudit(params: {
  id: string;
  verdict: "reviewed_ok" | "reviewed_violation";
  note?: string;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("chat_compliance_audits")
    .update({
      status: params.verdict,
      reviewer_id: user?.user?.id ?? null,
      reviewer_note: params.note ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.id);
  if (error) throw error;
}

export async function triggerAuditNow(
  forDay: string
): Promise<{ scanned: number; flagged: number }> {
  const { data, error } = await safeRpc("audit_chat_messages_daily", {
    p_for_day: forDay,
    p_sample_size: 100,
  });
  if (error) throw error;
  return data as unknown as { scanned: number; flagged: number };
}
