import type { Prisma, AuditAction } from "@prisma/client";

export interface WriteAuditLogInput {
  facilityId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: "Patient" | "TabRecord" | "User" | "ResearcherProfile" | "TabFieldPreference";
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
}

/**
 * Writes one AuditLog row. `tx` must be the same `Prisma.TransactionClient` as the mutation being
 * recorded — call this inside the mutation's own `prisma.$transaction(...)`, never after it. A
 * swallowed audit write on a successful mutation is exactly the silent compliance gap this pattern
 * exists to prevent, so there is deliberately no standalone "log after the fact" variant.
 */
export async function writeAuditLog(tx: Prisma.TransactionClient, input: WriteAuditLogInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      facilityId: input.facilityId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
      requestId: input.requestId ?? null,
    },
  });
}
