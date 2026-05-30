// TanStack Query hooks cho Compliance Audit Dashboard (Agent G3).
// - useComplianceList(filters): list rows với filter date + severity.
// - useComplianceStats(dateRange): stats KPI cho cards + chart.
// - useComplianceDetail(auditId): lazy — chỉ enabled khi auditId truthy.
//
// staleTime 60s vì data cron 2h sáng — không cần realtime.

import { useQuery } from "@tanstack/react-query";

import {
  getComplianceAuditDetail,
  getComplianceAuditStats,
  listComplianceAudits,
} from "../services/complianceService";

import type { ListAuditsFilters } from "../types";

const STALE_MS = 60_000;

export function useComplianceList(filters: ListAuditsFilters) {
  return useQuery({
    queryKey: ["chat-compliance", "list", filters],
    queryFn: () => listComplianceAudits(filters),
    staleTime: STALE_MS,
    enabled: !!filters.from && !!filters.to,
  });
}

export function useComplianceStats(dateRange: { from: string; to: string }) {
  return useQuery({
    queryKey: ["chat-compliance", "stats", dateRange.from, dateRange.to],
    queryFn: () => getComplianceAuditStats(dateRange.from, dateRange.to),
    staleTime: STALE_MS,
    enabled: !!dateRange.from && !!dateRange.to,
  });
}

export function useComplianceDetail(auditId: string | null) {
  return useQuery({
    queryKey: ["chat-compliance", "detail", auditId],
    queryFn: () => getComplianceAuditDetail(auditId as string),
    staleTime: STALE_MS,
    enabled: !!auditId,
  });
}
