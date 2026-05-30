// Trang Sales Inbox Chatbot — gộp 3 cột Sidebar / Thread / CustomerPanel.
// Plan 2 Task 9.

import { Card } from "antd";
import { useState } from "react";

import type { InboxSessionRow } from "@/features/chatbot/types/chat";

import { InboxCustomerPanel } from "@/features/chatbot/components/inbox/InboxCustomerPanel";
import { InboxSidebar } from "@/features/chatbot/components/inbox/InboxSidebar";
import { InboxThread } from "@/features/chatbot/components/inbox/InboxThread";

export default function ChatbotInboxPage() {
  const [selected, setSelected] = useState<InboxSessionRow | null>(null);
  return (
    <Card
      bodyStyle={{ padding: 0, height: "calc(100vh - 140px)" }}
      title="Inbox Chatbot"
    >
      <div style={{ display: "flex", height: "100%" }}>
        <InboxSidebar
          selectedSessionId={selected?.id ?? null}
          onSelectSession={setSelected}
        />
        <InboxThread session={selected} />
        <InboxCustomerPanel userId={selected?.user_id ?? null} />
      </div>
    </Card>
  );
}
