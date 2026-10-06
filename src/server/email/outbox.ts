import type { Prisma } from "@prisma/client";
import type { EmailOutbox } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { EmailPayload } from "@/domain/notifications/emailTemplates";
import { nextAttemptDelayMs, MAX_ATTEMPTS } from "@/domain/notifications/retryPolicy";

const LAST_ERROR_MAX_LENGTH = 2000;

// The queue seam — keep this interface stable, it's the swap point if the project ever moves
// to Redis/BullMQ.

/** Enqueue inside the caller's transaction. Mirrors writeAuditLog(tx, …) — never call it after the commit. */
export async function enqueueEmail(
  tx: Prisma.TransactionClient,
  input: { toEmail: string; payload: EmailPayload; idempotencyKey?: string }
): Promise<void> {
  try {
    await tx.emailOutbox.create({
      data: {
        template: input.payload.template,
        toEmail: input.toEmail,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch (err) {
    // P2002 on idempotencyKey means "already queued" — swallow it, that's the whole point of the key.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return;
    }
    throw err;
  }
}

/** Atomically claims up to `limit` due rows for this worker run — a claim-marker, not SELECT-then-UPDATE. */
export async function claimDueEmails(workerRunId: string, limit: number): Promise<EmailOutbox[]> {
  await prisma.$executeRaw`
    UPDATE email_outbox
    SET status = 'SENDING', claimedBy = ${workerRunId}, claimedAt = NOW()
    WHERE status = 'PENDING' AND nextAttemptAt <= NOW()
    ORDER BY nextAttemptAt
    LIMIT ${limit}
  `;

  return prisma.$queryRaw<EmailOutbox[]>`
    SELECT * FROM email_outbox WHERE claimedBy = ${workerRunId} AND status = 'SENDING'
  `;
}

export async function markSent(id: string): Promise<void> {
  await prisma.emailOutbox.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), claimedBy: null, claimedAt: null },
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  const attempts = row.attempts + 1;
  const truncatedError = error.slice(0, LAST_ERROR_MAX_LENGTH);

  await prisma.emailOutbox.update({
    where: { id },
    data: {
      attempts,
      lastError: truncatedError,
      claimedBy: null,
      claimedAt: null,
      status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      nextAttemptAt: new Date(Date.now() + nextAttemptDelayMs(attempts)),
    },
  });
}

/** Flips rows stuck in SENDING (a worker killed mid-send) back to PENDING. Delivery is at-least-once. */
export async function reclaimStuck(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.emailOutbox.updateMany({
    where: { status: "SENDING", claimedAt: { lt: cutoff } },
    data: { status: "PENDING", claimedBy: null, claimedAt: null },
  });
  return result.count;
}
