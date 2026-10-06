// Framework-free token policy; purpose union redeclared locally to keep @prisma/client out of domain/.

export type TokenPurpose = "EMAIL_VERIFICATION" | "ACCOUNT_INVITE" | "PASSWORD_RESET";

// 1h reset is a security boundary (live link = takeover vector); 7d invite isn't.
export const TTL_MS_BY_PURPOSE: Record<TokenPurpose, number> = {
  ACCOUNT_INVITE: 7 * 24 * 60 * 60_000,
  EMAIL_VERIFICATION: 24 * 60 * 60_000,
  PASSWORD_RESET: 60 * 60_000,
};

export type TokenCheck = "ok" | "expired" | "consumed" | "wrong-purpose";

/** Purpose is checked before expiry so a wrong-purpose token never reports as merely expired — otherwise a
 * 7-day invite token could be replayed against the 1-hour password-reset endpoint. */
export function checkToken(
  token: { purpose: TokenPurpose; expiresAt: Date; consumedAt: Date | null },
  expectedPurpose: TokenPurpose,
  now: Date
): TokenCheck {
  if (token.purpose !== expectedPurpose) return "wrong-purpose";
  if (token.consumedAt !== null) return "consumed";
  if (now >= token.expiresAt) return "expired";
  return "ok";
}
