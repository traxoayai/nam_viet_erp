import dayjs from "dayjs";
import { useState } from "react";

import {
  AnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/features/chatbot/components/analytics/AnalyticsFilters";
import { ExportCSVButton } from "@/features/chatbot/components/analytics/ExportCSVButton";
import { SessionsLineChart } from "@/features/chatbot/components/analytics/SessionsLineChart";
import { StatsCards } from "@/features/chatbot/components/analytics/StatsCards";
import { TopIntentsBarChart } from "@/features/chatbot/components/analytics/TopIntentsBarChart";
import { UnmatchedQuestionsTable } from "@/features/chatbot/components/analytics/UnmatchedQuestionsTable";
import { useChatStats } from "@/features/chatbot/hooks/useChatStats";

export default function ChatbotAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFiltersValue>({
    range: [dayjs().subtract(7, "day"), dayjs()],
  });

  const apiFilters = {
    from: filters.range[0].format("YYYY-MM-DD"),
    to: filters.range[1].format("YYYY-MM-DD"),
    platform: filters.platform,
  };
  const { overview, perDay, intents, unmatched } = useChatStats(apiFilters);

  return (
    <div style={{ padding: 24 }}>
      <h2>Báo cáo Chatbot</h2>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AnalyticsFilters value={filters} onChange={setFilters} />
        <ExportCSVButton
          filename={`chatbot-unmatched-${apiFilters.from}-${apiFilters.to}.csv`}
          rows={(unmatched.data ?? []).map((u) => ({
            question: u.question,
            occurred_at: u.occurred_at,
          }))}
          columns={[
            { key: "question", label: "Câu hỏi" },
            { key: "occurred_at", label: "Lúc" },
          ]}
        />
      </div>
      <StatsCards data={overview.data} loading={overview.isLoading} />
      <SessionsLineChart data={perDay.data} />
      <TopIntentsBarChart data={intents.data} />
      <UnmatchedQuestionsTable data={unmatched.data} />
    </div>
  );
}
