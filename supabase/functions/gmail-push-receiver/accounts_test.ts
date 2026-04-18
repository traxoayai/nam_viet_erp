import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { loadGmailAccounts } from "./accounts.ts";

Deno.test("loadGmailAccounts: single legacy account via GMAIL_USER_EMAIL + GMAIL_REFRESH_TOKEN", () => {
  const env = {
    GMAIL_USER_EMAIL: "legacy@gmail.com",
    GMAIL_REFRESH_TOKEN: "token-legacy",
  };
  const accounts = loadGmailAccounts((k) => env[k as keyof typeof env]);
  assertEquals(accounts.length, 1);
  assertEquals(accounts[0].email, "legacy@gmail.com");
  assertEquals(accounts[0].refreshToken, "token-legacy");
});

Deno.test("loadGmailAccounts: two numbered accounts", () => {
  const env = {
    GMAIL_ACCOUNT_1_EMAIL: "a@gmail.com",
    GMAIL_ACCOUNT_1_REFRESH_TOKEN: "tok-a",
    GMAIL_ACCOUNT_2_EMAIL: "b@gmail.com",
    GMAIL_ACCOUNT_2_REFRESH_TOKEN: "tok-b",
  };
  const accounts = loadGmailAccounts((k) => env[k as keyof typeof env]);
  assertEquals(accounts.length, 2);
  assertEquals(accounts[0], { email: "a@gmail.com", refreshToken: "tok-a" });
  assertEquals(accounts[1], { email: "b@gmail.com", refreshToken: "tok-b" });
});

Deno.test("loadGmailAccounts: numbered takes precedence over legacy", () => {
  const env = {
    GMAIL_USER_EMAIL: "legacy@gmail.com",
    GMAIL_REFRESH_TOKEN: "tok-legacy",
    GMAIL_ACCOUNT_1_EMAIL: "new@gmail.com",
    GMAIL_ACCOUNT_1_REFRESH_TOKEN: "tok-new",
  };
  const accounts = loadGmailAccounts((k) => env[k as keyof typeof env]);
  assertEquals(accounts.length, 1);
  assertEquals(accounts[0].email, "new@gmail.com");
});

Deno.test("loadGmailAccounts: empty env returns []", () => {
  const accounts = loadGmailAccounts(() => undefined);
  assertEquals(accounts.length, 0);
});

Deno.test("loadGmailAccounts: stops at first gap (e.g., _2 missing skips _3)", () => {
  const env = {
    GMAIL_ACCOUNT_1_EMAIL: "a@gmail.com",
    GMAIL_ACCOUNT_1_REFRESH_TOKEN: "tok-a",
    GMAIL_ACCOUNT_3_EMAIL: "c@gmail.com",
    GMAIL_ACCOUNT_3_REFRESH_TOKEN: "tok-c",
  };
  const accounts = loadGmailAccounts((k) => env[k as keyof typeof env]);
  assertEquals(accounts.length, 1);
});

Deno.test("loadGmailAccounts: partial account (email without token) is skipped", () => {
  const env = {
    GMAIL_ACCOUNT_1_EMAIL: "a@gmail.com",
    // no GMAIL_ACCOUNT_1_REFRESH_TOKEN
  };
  const accounts = loadGmailAccounts((k) => env[k as keyof typeof env]);
  assertEquals(accounts.length, 0);
});
