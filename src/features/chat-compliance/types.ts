// Types cho Compliance Audit Dashboard (Agent G3).
// - Match RPC return shape ở migration 20260518000008_compliance_audit_rpcs.sql.
// - severity union khớp CHECK constraint của bảng chat_compliance_audits.

export type ComplianceSeverity = "low" | "medium" | "high";

export type ComplianceAuditStatus =
  | "open"
  | "reviewed_ok"
  | "reviewed_violation";

/** 1 row trả về từ list_chat_compliance_audits */
export interface ComplianceAuditRow {
  audit_id: string;
  message_id: string;
  session_id: string;
  rule_code: string;
  severity: ComplianceSeverity;
  matched_keywords: string[] | null;
  excerpt: string | null;
  status: ComplianceAuditStatus;
  customer_email: string | null;
  customer_name: string | null;
  audit_created_at: string; // ISO timestamptz
}

export interface ComplianceMessage {
  id: string;
  session_id: string;
  role: "user" | "bot" | "sales" | "system";
  content_type: "text" | "image" | "card" | "postback";
  content: string | null;
  created_at: string;
}

export interface ComplianceAuditDetail {
  audit: {
    id: string;
    message_id: string;
    session_id: string;
    rule_code: string;
    severity: ComplianceSeverity;
    matched_keywords: string[] | null;
    excerpt: string | null;
    status: ComplianceAuditStatus;
    reviewer_id: string | null;
    reviewer_note: string | null;
    reviewed_at: string | null;
    audited_at: string;
  };
  anchor_message: ComplianceMessage | null;
  messages_before: ComplianceMessage[];
  messages_after: ComplianceMessage[];
  customer: {
    user_id: string | null;
    email: string | null;
    display_name: string | null;
    platform: string | null;
    session_status: string | null;
  };
  not_found?: boolean;
}

export interface ComplianceStats {
  total: number;
  by_severity: {
    high: number;
    medium: number;
    low: number;
  };
  by_day: Array<{ day: string; count: number }>;
}

export interface ListAuditsFilters {
  /** ISO date YYYY-MM-DD */
  from: string;
  /** ISO date YYYY-MM-DD */
  to: string;
  severity?: ComplianceSeverity | null;
  limit?: number;
  offset?: number;
}
