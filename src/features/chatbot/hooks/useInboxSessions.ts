// Hook list sessions cho Sales Inbox (Plan 2 Task 5).
// - Source data: RPC `list_inbox_sessions` qua `listInboxSessions`.
// - Realtime: subscribe `chat_sessions` (event *) + `chat_handoffs` (INSERT)
//   để invalidate query khi có session mới hoặc handoff mới.
// - staleTime 5s tránh refetch quá thường xuyên khi switch tab nhanh.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { listInboxSessions } from "../api/inboxApi";

import { supabase } from "@/shared/lib/supabaseClient";

export type InboxTab = "pending" | "active" | "closed";

export function useInboxSessions(tab: InboxTab) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chatbot", "inbox", tab],
    queryFn: () => listInboxSessions({ tab }),
    staleTime: 5_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${tab}`)
      .on(
        // Supabase typings cho postgres_changes là literal — cast để TS chấp nhận
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "chat_sessions" },
        () => {
          void qc.invalidateQueries({ queryKey: ["chatbot", "inbox"] });
        }
      )
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "chat_handoffs" },
        () => {
          void qc.invalidateQueries({ queryKey: ["chatbot", "inbox"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tab, qc]);

  return query;
}
