import { randomBytes, createHash } from "crypto";
import type { Prisma, CredentialTokenPurpose } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { checkToken, TTL_MS_BY_PURPOSE, type TokenPurpose } from "@/domain/auth/credentialToken";
import { tokenInvalidError, tokenExpiredError, tokenWrongPurposeError } from "./errors";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Returns the raw token for the email link; only its hash is persisted. */
export async function issueToken(
  tx: Prisma.TransactionClient,
  userId: string,
  purpose: CredentialTokenPurpose
): Promise<string> {
  // Issuing a new link must invalidate any outstanding one of the same purpose.
  await tx.credentialToken.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString("base64url");
  await tx.credentialToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + TTL_MS_BY_PURPOSE[purpose as TokenPurpose]),
    },
  });

  return rawToken;
}

// Wrong-purpose and unknown-hash both surface the same generic client message; only logging differs.
export async function consumeToken(
  tx: Prisma.TransactionClient,
  rawToken: string,
  expectedPurpose: CredentialTokenPurpose | CredentialTokenPurpose[]
): Promise<{ userId: string; purpose: CredentialTokenPurpose }> {
  const allowedPurposes = Array.isArray(expectedPurpose) ? expectedPurpose : [expectedPurpose];

  const tokenHash = hashToken(rawToken);
  const token = await tx.credentialToken.findUnique({ where: { tokenHash } });
  if (!token) throw tokenInvalidError();
  if (!allowedPurposes.includes(token.purpose)) throw tokenWrongPurposeError();

  const result = checkToken(token, token.purpose as TokenPurpose, new Date());
  if (result === "expired") throw tokenExpiredError();
  if (result === "consumed") throw tokenInvalidError();

  await tx.credentialToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
  return { userId: token.userId, purpose: token.purpose };
}

/** Invalidates every outstanding (unconsumed) token for this user, across every purpose — used when setting
 * a password, so an old invite/reset link already in someone's inbox can't be replayed afterward. */
export async function invalidateAllTokens(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.credentialToken.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

/** Marks any outstanding ACCOUNT_INVITE token as consumed without needing the raw value — used when
 * Google sign-in grants access directly, so a set-password link already in the inbox can't be replayed. */
export async function consumeOutstandingInvite(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.credentialToken.updateMany({
    where: { userId, purpose: "ACCOUNT_INVITE", consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export type TokenPeekResult =
  | { status: "ok"; purpose: CredentialTokenPurpose }
  | { status: "invalid" }
  | { status: "expired" };

/** Read-only check for rendering the set-password page: looks at a token's current state without consuming
 * it (consumption happens only on the actual POST /api/auth/set-password submit). */
export async function peekToken(rawToken: string, allowedPurposes: CredentialTokenPurpose[]): Promise<TokenPeekResult> {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.credentialToken.findUnique({ where: { tokenHash } });
  if (!token || !allowedPurposes.includes(token.purpose)) return { status: "invalid" };

  const result = checkToken(token, token.purpose as TokenPurpose, new Date());
  if (result === "expired") return { status: "expired" };
  if (result === "consumed") return { status: "invalid" };
  return { status: "ok", purpose: token.purpose };
}
