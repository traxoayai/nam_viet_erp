// API wrappers cho Sales Inbox (Plan 2 Task 4).
// Quy tắc: mọi RPC PHẢI qua safeRpc; chỉ select/insert thẳng table khi
// RLS đã policy đúng (ví dụ load thread theo session_id, insert feedback).

import type {
  ChatFeedbackType,
  ChatMessage,
  InboxSessionRow,
} from "../types/chat";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export type InboxTab = "pending" | "active" | "closed";

export async function listInboxSessions(params: {
  tab: InboxTab;
  limit?: number;
}): Promise<InboxSessionRow[]> {
  const { data, error } = await safeRpc("list_inbox_sessions", {
    p_tab: params.tab,
    p_limit: params.limit ?? 50,
  });
  if (error) throw error;
  return (data ?? []) as unknown as InboxSessionRow[];
}

export async function loadSessionThread(
  sessionId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ChatMessage[];
}

export async function assignSelfToSession(sessionId: string): Promise<void> {
  const { error } = await safeRpc("assign_chat_session_to_self", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function sendSalesReply(params: {
  sessionId: string;
  content: string;
}): Promise<ChatMessage> {
  const { data, error } = await safeRpc("send_sales_reply", {
    p_session_id: params.sessionId,
    p_content: params.content,
  });
  if (error) throw error;
  return data as unknown as ChatMessage;
}

export async function closeSession(sessionId: string): Promise<void> {
  const { error } = await safeRpc("close_chat_session", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function returnToBot(sessionId: string): Promise<void> {
  const { error } = await safeRpc("return_chat_session_to_bot", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function reportFeedback(params: {
  messageId: string;
  feedbackType: ChatFeedbackType;
  note?: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const reporterId = userData?.user?.id;
  if (!reporterId) throw new Error("Chưa đăng nhập");
  const { error } = await supabase.from("chat_feedback").insert({
    message_id: params.messageId,
    reporter_id: reporterId,
    feedback_type: params.feedbackType,
    note: params.note ?? null,
  });
  if (error) throw error;
}
