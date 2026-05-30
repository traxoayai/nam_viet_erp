// Trang Audit tuân thủ Chatbot — G3 Compliance Dashboard.
// - Replaced legacy wrapper bằng dashboard mới (stats + chart + table + drawer).
// - Re-export feature page; cả route `/marketing/chatbot/compliance` và
//   `/chat-compliance` đều render trang này.

import CompliancePage from "@/features/chat-compliance/pages/CompliancePage";

export default function ChatbotComplianceAuditPage() {
  return <CompliancePage />;
}
