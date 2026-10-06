// Standalone pm2 process that drains the email_outbox. Infrastructure, not app code — lives in
// scripts/ alongside deploy.sh/smoke.sh/security-scan.sh/audit-gate.mjs, not in src/.

// Unlike `next dev`, tsx never loads .env on its own. Must stay the first import so config/env.ts
// sees these values when it reads process.env at module scope.
import "dotenv/config";
import { randomUUID } from "crypto";
import { z } from "zod";
import { assertEmailConfigured } from "@/config/env";
import { log } from "@/server/http/logger";
import { claimDueEmails, markFailed, markSent, reclaimStuck } from "@/server/email/outbox";
import { renderEmail, type EmailPayload } from "@/domain/notifications/emailTemplates";
import { getMailer } from "@/server/email/transport";

const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 10;
const STUCK_CUTOFF_MS = 5 * 60_000;

const emailPayloadSchema: z.ZodType<EmailPayload> = z.union([
  z.object({ template: z.literal("researcher-verify-email"), name: z.string(), verifyUrl: z.string() }),
  z.object({
    template: z.literal("researcher-request-submitted"),
    researcherName: z.string(),
    researcherEmail: z.string(),
    institution: z.string(),
    purpose: z.string(),
    reviewUrl: z.string(),
  }),
  z.object({ template: z.literal("researcher-approved"), name: z.string(), signInUrl: z.string() }),
  z.object({ template: z.literal("researcher-rejected"), name: z.string(), reviewNote: z.string().optional() }),
  z.object({
    template: z.literal("facility-admin-invite"),
    name: z.string(),
    facilityName: z.string(),
    setPasswordUrl: z.string(),
    expiresInDays: z.number(),
  }),
  z.object({
    template: z.literal("patient-portal-invite"),
    name: z.string(),
    facilityName: z.string(),
    setPasswordUrl: z.string(),
    expiresInDays: z.number(),
  }),
  z.object({
    template: z.literal("password-reset"),
    name: z.string(),
    resetUrl: z.string(),
    expiresInMinutes: z.number(),
  }),
  z.object({ template: z.literal("password-changed"), name: z.string(), supportHint: z.string() }),
  z.object({
    template: z.literal("google-account-linked"),
    name: z.string(),
    googleEmail: z.string(),
    supportHint: z.string(),
  }),
]);

let draining = false;

async function reportToSentry(message: string, extra: Record<string, unknown>): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  // Required lazily, matching src/server/http/logger.ts, so envs without Sentry never load it.
  const Sentry = require("@sentry/nextjs");
  Sentry.captureMessage(message, { level: "error", extra });
}

async function processRow(runId: string): Promise<void> {
  const rows = await claimDueEmails(runId, BATCH_SIZE);

  for (const row of rows) {
    const parsed = emailPayloadSchema.safeParse(row.payload);

    if (!parsed.success) {
      // A parse failure is permanent, not transient — don't retry five times against it.
      await markFailed(row.id, `payload no longer matches EmailPayload schema: ${parsed.error.message}`);
      log.error({ id: row.id, template: row.template }, "email outbox row has an invalid payload");
      await reportToSentry("email outbox row has an invalid payload", { id: row.id, template: row.template });
      continue;
    }

    try {
      const rendered = renderEmail(parsed.data);
      await getMailer().send({ to: row.toEmail, subject: rendered.subject, text: rendered.text, html: rendered.html });
      await markSent(row.id);
      log.info({ id: row.id, template: row.template }, "email sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(row.id, message);
      log.warn({ id: row.id, template: row.template, error: message }, "email send failed");

      const refreshedAttempts = row.attempts + 1;
      if (refreshedAttempts >= 5) {
        log.error({ id: row.id, template: row.template }, "email permanently failed after exhausting retries");
        await reportToSentry("email permanently failed after exhausting retries", { id: row.id, template: row.template });
      }
    }
  }
}

async function loop(runId: string): Promise<void> {
  while (!draining) {
    const reclaimed = await reclaimStuck(STUCK_CUTOFF_MS);
    if (reclaimed > 0) log.warn({ reclaimed }, "reclaimed stuck SENDING rows back to PENDING");

    await processRow(runId);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") assertEmailConfigured();

  const runId = randomUUID();
  log.info({ runId }, "email worker starting, polling every 10s");

  const shutdown = (signal: string) => {
    log.info({ runId, signal }, "email worker draining in-flight batch before exit");
    draining = true;
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await loop(runId);
  log.info({ runId }, "email worker exited cleanly");
  process.exit(0);
}

main().catch((err) => {
  log.error({ error: err instanceof Error ? err.message : String(err) }, "email worker crashed");
  process.exit(1);
});
