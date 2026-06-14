import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

import { getAccountState, setAccountState, stateKey } from "./state.ts";

// Mock SupabaseClient chi cho 2 method dung trong helpers
function makeMockSupabase(store: Record<string, unknown> = {}) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, key: string) {
              return {
                single: async () => {
                  const val = store[key];
                  return val === undefined
                    ? { data: null, error: { code: "PGRST116" } }
                    : { data: { value: val }, error: null };
                },
              };
            },
          };
        },
        upsert(row: { key: string; value: unknown }) {
          store[row.key] = row.value;
          return { error: null };
        },
      };
    },
    _store: store,
  };
}

Deno.test("stateKey: formats email into system_settings key", () => {
  assertEquals(stateKey("hung@gmail.com"), "gmail_state:hung@gmail.com");
});

Deno.test("getAccountState: returns defaults when missing", async () => {
  const mock = makeMockSupabase();
  // deno-lint-ignore no-explicit-any
  const state = await getAccountState(mock as unknown, "missing@gmail.com");
  assertEquals(state, { historyId: "0", expiry: 0 });
});

Deno.test("getAccountState: reads existing jsonb state", async () => {
  const mock = makeMockSupabase({
    "gmail_state:a@gmail.com": { historyId: "123", expiry: 999 },
  });
  // deno-lint-ignore no-explicit-any
  const state = await getAccountState(mock as unknown, "a@gmail.com");
  assertEquals(state, { historyId: "123", expiry: 999 });
});

Deno.test("setAccountState: upserts jsonb state", async () => {
  const mock = makeMockSupabase();
  // deno-lint-ignore no-explicit-any
  await setAccountState(mock as unknown, "b@gmail.com", {
    historyId: "456",
    expiry: 1000,
  });
  assertEquals(mock._store["gmail_state:b@gmail.com"], {
    historyId: "456",
    expiry: 1000,
  });
});

Deno.test(
  "getAccountState: coerces number historyId to string (Pub/Sub quirk)",
  async () => {
    const mock = makeMockSupabase({
      "gmail_state:n@gmail.com": { historyId: 789012, expiry: 555 },
    });
    // deno-lint-ignore no-explicit-any
    const state = await getAccountState(mock as unknown, "n@gmail.com");
    assertEquals(state, { historyId: "789012", expiry: 555 });
  }
);

Deno.test(
  "setAccountState: coerces historyId to string before persisting",
  async () => {
    const mock = makeMockSupabase();
    // deno-lint-ignore no-explicit-any
    await setAccountState(mock as unknown, "c@gmail.com", {
      historyId: 999 as unknown as string,
      expiry: 2000,
    });
    assertEquals(mock._store["gmail_state:c@gmail.com"], {
      historyId: "999",
      expiry: 2000,
    });
  }
);
