// Hook query danh sách audit tuân thủ chatbot (Plan 2 Task 18).
// - staleTime 30s: data audit cron chạy 2h sáng, không cần realtime.

import { useQuery } from "@tanstack/react-query";

import { listAudits } from "../api/complianceApi";

export function useComplianceAudits(status: "open" | "all") {
  return useQuery({
    queryKey: ["chatbot", "audits", status],
    queryFn: () => listAudits(status),
    staleTime: 30_000,
  });
}
