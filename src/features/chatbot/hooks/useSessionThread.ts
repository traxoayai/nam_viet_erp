// Hook load thread của một session + realtime append message mới (Plan 2 Task 5).
// - Source data: select chat_messages where session_id (qua loadSessionThread).
// - Realtime: filter INSERT theo session_id, dedupe trong setQueryData để
//   tránh trùng khi message do chính sales gửi (đã được client thêm optimistic
//   ở Task sau).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { loadSessionThread } from "../api/inboxApi";

import type { ChatMessage } from "../types/chat";

import { supabase } from "@/shared/lib/supabaseClient";

export function useSessionThread(sessionId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chatbot", "thread", sessionId],
    queryFn: () =>
      sessionId
        ? loadSessionThread(sessionId)
        : Promise.resolve([] as ChatMessage[]),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`thread:${sessionId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: { new: ChatMessage }) => {
          const incoming = payload.new;
          qc.setQueryData<ChatMessage[]>(
            ["chatbot", "thread", sessionId],
            (old = []) => {
              if (old.some((m) => m.id === incoming.id)) return old;
              return [...old, incoming];
            }
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}
