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

  const value = data.value as Partial<AccountState> | null;
  if (!value) return { ...DEFAULT_STATE };

  return {
    historyId: typeof value.historyId === "string" ? value.historyId : "0",
    expiry: typeof value.expiry === "number" ? value.expiry : 0,
  };
}

export async function setAccountState(
  supabase: SupabaseClient,
  email: string,
  state: AccountState,
): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: stateKey(email), value: state }, { onConflict: "key" });

  if (error) {
    console.error(`setAccountState[${email}] error:`, error.message);
  }
}
