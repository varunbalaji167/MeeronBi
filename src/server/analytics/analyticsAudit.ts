// Non-fatal: a logging failure never 500s a successful analytics response.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { log } from "@/server/http/logger";
import { AnalyticsAuditPayload } from "@/domain/analytics/auditPayload";

export interface LogAnalyticsQueryInput {
  /** Actor's home facility — cross-facility queries record their real scope in `payload.scope`, not here. */
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
