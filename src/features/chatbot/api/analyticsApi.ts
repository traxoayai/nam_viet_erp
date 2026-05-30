// API wrappers cho Chatbot Analytics (Plan 2 Task 11).
// Quy tắc: mọi RPC PHẢI qua safeRpc; không gọi supabase.rpc trực tiếp.

import { safeRpc } from "@/shared/lib/safeRpc";

export interface ChatStatsOverview {
  total_sessions: number;
  orders_via_bot: number;
  handoff_rate: number;
  ai_cost_usd: number;
  orders_note?: string;
}

export interface SessionPerDay {
  day: string;
  sessions: number;
  orders: number;
}

export interface IntentCount {
  intent: string;
  count: number;
}

export interface UnmatchedQuestion {
  question: string;
  occurred_at: string;
  session_id: string;
}

export interface AnalyticsFilters {
  from: string;
  to: string;
  platform?: "web" | "zalo" | "fb";
}

export async function fetchStatsOverview(
  f: AnalyticsFilters
): Promise<ChatStatsOverview> {
  const { data, error } = await safeRpc("chat_stats_overview", {
    p_from: f.from,
    p_to: f.to,
    p_platform: (f.platform ?? null) as any,
  });
  if (error) throw error;
  return data as unknown as ChatStatsOverview;
}

export async function fetchSessionsPerDay(
  f: AnalyticsFilters
): Promise<SessionPerDay[]> {
  const { data, error } = await safeRpc("chat_sessions_per_day", {
    p_from: f.from,
    p_to: f.to,
    p_platform: (f.platform ?? null) as any,
  });
  if (error) throw error;
  return (data ?? []) as unknown as SessionPerDay[];
}

export async function fetchTopIntents(
  f: AnalyticsFilters,
  limit = 10
): Promise<IntentCount[]> {
  const { data, error } = await safeRpc("chat_top_intents", {
    p_from: f.from,
    p_to: f.to,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as IntentCount[];
}

export async function fetchUnmatched(
  f: AnalyticsFilters,
  limit = 20
): Promise<UnmatchedQuestion[]> {
  const { data, error } = await safeRpc("chat_unmatched_questions", {
    p_from: f.from,
    p_to: f.to,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as UnmatchedQuestion[];
}
