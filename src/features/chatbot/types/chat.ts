// Types cho chatbot domain (Plan 2 Task 4 — Sales Inbox foundation)
// Đồng bộ với schema chat_sessions / chat_messages ở
// supabase/migrations/20260515000001_chat_tables.sql

export type ChatSessionStatus = "bot" | "handoff_pending" | "human" | "closed";
export type ChatRole = "user" | "bot" | "sales" | "system";
export type ChatContentType = "text" | "image" | "card" | "postback";
export type ChatPlatform = "web" | "zalo" | "fb";

export type ChatFeedbackType =
  | "wrong_answer"
  | "fabricated_sku"
  | "wrong_price"
  | "medical_advice"
  | "other";

export interface ChatSession {
  id: string;
  user_id: string;
  status: ChatSessionStatus;
  assigned_sales_id: string | null;
  draft_cart_id: string | null;
  platform: ChatPlatform;
  context: Record<string, unknown>;
  started_at: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content_type: ChatContentType;
  content: string | null;
  attachments: unknown;
  llm_meta: Record<string, unknown> | null;
  intent: string | null;
  entities: Record<string, unknown> | null;
  deleted_at: string | null;
  created_at: string;
}

/**
 * Row do RPC `list_inbox_sessions` trả về — bổ sung customer info +
 * preview tin cuối + handoff reason đang chờ. Tham chiếu cột
 * `portal_users.display_name` và `portal_users.phone` (đã verify
 * schema thực tế tại 2026-05-16).
 */
export interface InboxSessionRow extends ChatSession {
  customer_name: string | null;
  customer_phone: string | null;
  unresolved_handoff_reason: string | null;
  last_message_preview: string | null;
  last_message_at: string;
}
