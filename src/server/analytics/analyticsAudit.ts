// Analytics-query audit logging. Unlike `writeAuditLog` (src/server/http/audit.ts), there's no
// surrounding mutation transaction to join — a cohort query is read-only — so this writes the
// `AuditLog` row directly and is deliberately non-fatal: a logging failure must never turn a
// successful analytics response into a 500 (see analyticsService.ts's call site).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { log } from "@/server/http/logger";
import { AnalyticsAuditPayload } from "@/domain/analytics/auditPayload";

export interface LogAnalyticsQueryInput {
  /** Row is anchored to the actor's home facility — `AuditLog.facilityId` is a required FK, so a
   * cross-facility (SUPER_ADMIN/RESEARCHER) query can't be stored as literal "all"; the payload's
   * `scope` field carries the query's actual scope instead. */
  facilityId: string;
  actorUserId: string;
  payload: AnalyticsAuditPayload;
}

export async function logAnalyticsQuery(input: LogAnalyticsQueryInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        facilityId: input.facilityId,
        actorUserId: input.actorUserId,
        action: "ANALYTICS_QUERY",
        entityType: "Analytics",
        entityId: input.actorUserId,
        after: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    log.error({ error: String(error) }, "Failed to write analytics-query audit log");
  }
}
