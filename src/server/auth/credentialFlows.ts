import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { ValidationError } from "@/server/http/errors";
import { writeAuditLog } from "@/server/http/audit";
import { enqueueEmail } from "@/server/email/outbox";
import { appUrl } from "@/config/env";
import { TTL_MS_BY_PURPOSE } from "@/domain/auth/credentialToken";
import { GOOGLE_OAUTH_PROVIDER } from "@/domain/auth/googleSignIn";
import { issueToken, consumeToken, invalidateAllTokens, consumeOutstandingInvite } from "./credentialTokens";
import { notifySuperAdminsOfResearcherRequest } from "@/server/researchers/researcherAccessService";

const MIN_PASSWORD_LENGTH = 6;
const PASSWORD_RESET_EXPIRES_MINUTES = TTL_MS_BY_PURPOSE.PASSWORD_RESET / 60_000;

/**
 * Consumes an ACCOUNT_INVITE or PASSWORD_RESET token and sets the account's password. Verifying the email
 * is folded in here too: clicking a link sent to that address proves control of it, whichever of the two
 * purposes brought the user here.
 */
export async function setPassword(rawToken: string, password: string): Promise<{ email: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
      password: `Must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  return prisma.$transaction(async (tx) => {
    const { userId } = await consumeToken(tx, rawToken, ["ACCOUNT_INVITE", "PASSWORD_RESET"]);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const user = await tx.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now, emailVerifiedAt: now },
    });

    // A reset/invite link is single-use per purpose already; this also invalidates any other
    // outstanding token (of any purpose) for the account so an old link can't be replayed later.
    await invalidateAllTokens(tx, userId);

    await writeAuditLog(tx, {
      facilityId: user.facilityId,
      actorUserId: userId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      after: { passwordChanged: true },
    });

    // A security control, not a courtesy: this is how a victim learns someone else reset their password.
    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "password-changed",
        name: user.name ?? user.email,
        supportHint: "contact the MeeronBi team right away.",
      },
    });

    return { email: user.email };
  });
}

/**
 * Public, self-serve "forgot password" entry point. Always succeeds from the caller's point of view —
 * the route layer responds 200 regardless of what this function does, so it must never throw for an
 * unknown email (see the route's own privacy-justification comment).
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, facilityId: true } });
  if (!user) return;

  await prisma.$transaction(async (tx) => {
    const rawToken = await issueToken(tx, user.id, "PASSWORD_RESET");
    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "password-reset",
        name: user.name ?? user.email,
        resetUrl: `${appUrl}/set-password?token=${rawToken}`,
        expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
      },
    });
  });
}

/** Consumes an EMAIL_VERIFICATION token, stamps emailVerifiedAt, and — for a researcher — fans the
 * request out to super admins. The fan-out only fires here, never at signup, so junk/typo'd
 * addresses never reach the review queue. */
export async function verifyEmail(rawToken: string): Promise<{ email: string }> {
  return prisma.$transaction(async (tx) => {
    const { userId } = await consumeToken(tx, rawToken, "EMAIL_VERIFICATION");
    const user = await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await notifySuperAdminsOfResearcherRequest(tx, userId);
    return { email: user.email };
  });
}

/** Links a Google identity to an existing user found by email (the `link-then-allow` verdict),
 * stamps emailVerifiedAt if unset, consumes any outstanding invite, and notifies the owner. */
export async function linkGoogleAccount(userId: string, googleSub: string, googleEmail: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    await tx.oAuthAccount.create({
      data: { provider: GOOGLE_OAUTH_PROVIDER, providerAccountId: googleSub, userId },
    });

    if (!user.emailVerifiedAt) {
      await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    }

    await consumeOutstandingInvite(tx, userId);

    await writeAuditLog(tx, {
      facilityId: user.facilityId,
      actorUserId: userId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      after: { googleLinked: true },
    });

    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "google-account-linked",
        name: user.name ?? user.email,
        googleEmail,
        supportHint: "contact the MeeronBi team right away.",
      },
      idempotencyKey: `google-linked:${userId}:${googleSub}`,
    });
  });
}

/**
 * Public resend entry point for an unverified account. Always succeeds from the caller's point of view,
 * same no-enumeration rule as requestPasswordReset.
 */
export async function resendVerificationEmail(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  if (!email) return;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return;

  await prisma.$transaction(async (tx) => {
    const rawToken = await issueToken(tx, user.id, "EMAIL_VERIFICATION");
    await enqueueEmail(tx, {
      toEmail: user.email,
      payload: {
        template: "researcher-verify-email",
        name: user.name ?? user.email,
        verifyUrl: `${appUrl}/verify-email?token=${rawToken}`,
      },
    });
  });
}
