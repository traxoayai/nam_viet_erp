// Hook push notification toàn cục cho Sales khi có handoff mới (Plan 2 Task 21).
// - Gắn ở MainLayout, chỉ kích hoạt cho user có quyền `crm.chatbot.handle`.
// - Realtime: subscribe `chat_handoffs` (INSERT) qua channel `global:chat_handoffs`.
// - Khi có row mới: AntD notification (warning) + browser Notification (nếu đã grant)
//   + invalidate query `['chatbot','inbox']` để badge/list refresh ngay.
// - Self-gate qua flag `enabled` để caller không cần unmount khi đổi quyền.

import { useQueryClient } from "@tanstack/react-query";
import { notification } from "antd";
import { useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

type HandoffInsertPayload = {
  new: { reason?: string };
};

export function useHandoffNotifications(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("global:chat_handoffs")
      .on(
        // Supabase typings cho postgres_changes là literal — cast để TS chấp nhận
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "chat_handoffs" },
        (payload: HandoffInsertPayload) => {
          const reason = payload.new?.reason ?? "Khách cần hỗ trợ";

          notification.warning({
            message: "Có khách cần hỗ trợ",
            description: reason,
            placement: "topRight",
          });

          void qc.invalidateQueries({ queryKey: ["chatbot", "inbox"] });

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Chatbot Nam Việt", { body: reason });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
