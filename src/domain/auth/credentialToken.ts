// Pure credential-token policy — no Prisma import, so this file stays framework-free.
// The purpose union is redeclared locally rather than imported from @prisma/client.

export type TokenPurpose = "EMAIL_VERIFICATION" | "ACCOUNT_INVITE" | "PASSWORD_RESET";

// The TTLs differ deliberately: a 7-day invite is fine (a newly provisioned admin may not
// check mail today), but a 1-hour reset window is a security boundary, not generosity to
// be extended — a live reset link is an account takeover vector.
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
