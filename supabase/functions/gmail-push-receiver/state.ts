import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AccountState {
  historyId: string;
  expiry: number;
}

const DEFAULT_STATE: AccountState = { historyId: "0", expiry: 0 };

export function stateKey(email: string): string {
  return `gmail_state:${email}`;
}

export async function getAccountState(
  supabase: SupabaseClient,
  email: string,
): Promise<AccountState> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", stateKey(email))
    .single();

  if (error || !data) return { ...DEFAULT_STATE };

  const value = data.value as { historyId?: unknown; expiry?: unknown } | null;
  if (!value) return { ...DEFAULT_STATE };

  // Accept historyId nhu string hoac number (Gmail Pub/Sub co the gui number).
  const rawHistory = value.historyId;
  const historyId = typeof rawHistory === "string"
    ? rawHistory
    : typeof rawHistory === "number"
    ? String(rawHistory)
    : "0";

  return {
    historyId,
    expiry: typeof value.expiry === "number" ? value.expiry : 0,
  };
}

export async function setAccountState(
  supabase: SupabaseClient,
  email: string,
  state: AccountState,
): Promise<void> {
  // Force historyId ve string truoc khi luu (Gmail push co the truyen number).
  const normalized: AccountState = {
    historyId: String(state.historyId),
    expiry: Number(state.expiry),
  };
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: stateKey(email), value: normalized }, { onConflict: "key" });

  if (error) {
    console.error(`setAccountState[${email}] error:`, error.message);
  }
}
