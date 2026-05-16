// Trang Audit tuân thủ Chatbot (Plan 2 Task 18).
// Wrap ComplianceAuditList; data flow xem `complianceApi.ts`.

import { ComplianceAuditList } from "@/features/chatbot/components/compliance/ComplianceAuditList";

export default function ChatbotComplianceAuditPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Audit tuân thủ Chatbot</h2>
      <p style={{ color: "#888" }}>
        Hệ thống tự sample 50 tin bot/ngày lúc 2h sáng (pg_cron), flag câu có
        dấu hiệu tư vấn thuốc (R-04).
      </p>
      <ComplianceAuditList />
    </div>
  );
}
