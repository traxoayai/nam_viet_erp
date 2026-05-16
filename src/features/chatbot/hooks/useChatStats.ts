// Hook chạy 4 query analytics song song (Plan 2 Task 11.2).
// - Trả từng query slot để UI render skeleton/loading riêng từng card.
// - Query key gắn filters để switch khoảng ngày sẽ refetch tự động.

import { useQueries } from "@tanstack/react-query";

import {
  fetchSessionsPerDay,
  fetchStatsOverview,
  fetchTopIntents,
  fetchUnmatched,
  type AnalyticsFilters,
} from "../api/analyticsApi";

export function useChatStats(filters: AnalyticsFilters) {
  const [overview, perDay, intents, unmatched] = useQueries({
    queries: [
      {
        queryKey: ["chatbot", "stats", filters],
        queryFn: () => fetchStatsOverview(filters),
      },
      {
        queryKey: ["chatbot", "sessions-per-day", filters],
        queryFn: () => fetchSessionsPerDay(filters),
      },
      {
        queryKey: ["chatbot", "top-intents", filters],
        queryFn: () => fetchTopIntents(filters),
      },
      {
        queryKey: ["chatbot", "unmatched", filters],
        queryFn: () => fetchUnmatched(filters),
      },
    ],
  });
  return { overview, perDay, intents, unmatched };
}
