// Service wrapper RPC cho Compliance Audit Dashboard (Agent G3).
// - 100% qua safeRpc — KHÔNG gọi supabase.rpc trực tiếp.
// - Param types khớp PG types: date dùng `|| null`, không bao giờ `|| ""`.

import type {
  ComplianceAuditDetail,
  ComplianceAuditRow,
  ComplianceStats,
  ListAuditsFilters,
} from "../types";

import { safeRpc } from "@/shared/lib/safeRpc";

/**
 * List audit rows trong khoảng date có pagination + severity filter.
 * - p_severity NULL = tất cả (không pass "" vì PG sẽ filter rỗng).
 */
export async function listComplianceAudits(
  filters: ListAuditsFilters
): Promise<ComplianceAuditRow[]> {
  const { data, error } = await safeRpc("list_chat_compliance_audits", {
    p_from: (filters.from || null) as any,
    p_to: (filters.to || null) as any,
    p_severity: filters.severity ?? undefined,
    p_limit: filters.limit ?? 100,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ComplianceAuditRow[];
}

/**
 * Detail 1 audit + 3 msg trước/sau anchor để hiểu context.
 * - Trả ComplianceAuditDetail; có field not_found=true nếu audit không tồn tại.
 */
export async function getComplianceAuditDetail(
  auditId: string
): Promise<ComplianceAuditDetail> {
  const { data, error } = await safeRpc("get_compliance_audit_detail", {
    p_audit_id: auditId,
  });
  if (error) throw error;
  return data as unknown as ComplianceAuditDetail;
}

/**
 * Stats KPI: total, by_severity, by_day series.
 */
export async function getComplianceAuditStats(
  from: string,
  to: string
): Promise<ComplianceStats> {
  const { data, error } = await safeRpc("get_compliance_audit_stats", {
    p_from: (from || null) as any,
    p_to: (to || null) as any,
  });
  if (error) throw error;
  return data as unknown as ComplianceStats;
}
