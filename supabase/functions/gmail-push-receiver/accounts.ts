const MAX_ACCOUNTS = 10;
/**
 * Doc danh sach Gmail accounts tu env.
 *
 * Uu tien: numbered vars (GMAIL_ACCOUNT_1_EMAIL, GMAIL_ACCOUNT_1_REFRESH_TOKEN, ...)
 * Fallback: legacy single (GMAIL_USER_EMAIL, GMAIL_REFRESH_TOKEN) neu khong co numbered.
 *
 * Dung EnvReader de test de (inject mock thay vi doc Deno.env).
 */ export function loadGmailAccounts(getEnv) {
  const accounts = [];
  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    const email = getEnv(`GMAIL_ACCOUNT_${i}_EMAIL`);
    const refreshToken = getEnv(`GMAIL_ACCOUNT_${i}_REFRESH_TOKEN`);
    if (!email || !refreshToken) break;
    accounts.push({
      email,
      refreshToken,
    });
  }
  if (accounts.length > 0) return accounts;
  // Legacy fallback
  const legacyEmail = getEnv("GMAIL_USER_EMAIL");
  const legacyToken = getEnv("GMAIL_REFRESH_TOKEN");
  if (legacyEmail && legacyToken) {
    return [
      {
        email: legacyEmail,
        refreshToken: legacyToken,
      },
    ];
  }
  return [];
}
