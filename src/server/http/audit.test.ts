import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "./audit";

function fakeTx() {
  const create = vi.fn().mockResolvedValue({});
  return { tx: { auditLog: { create } } as unknown as Prisma.TransactionClient, create };
}

describe("writeAuditLog", () => {
  it("maps its input onto tx.auditLog.create's data shape, defaulting actorUserId/requestId to null", async () => {
    const { tx, create } = fakeTx();
    await writeAuditLog(tx, {
      facilityId: "fac_1",
      action: "UPDATE",
      entityType: "Patient",
      entityId: "pat_1",
      before: { fullName: "Old" },
      after: { fullName: "New" },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        facilityId: "fac_1",
        actorUserId: null,
        action: "UPDATE",
        entityType: "Patient",
        entityId: "pat_1",
        before: { fullName: "Old" },
        after: { fullName: "New" },
        requestId: null,
      },
    });
  });

  it("carries actorUserId and requestId through when provided", async () => {
    const { tx, create } = fakeTx();
    await writeAuditLog(tx, {
      facilityId: "fac_1",
      actorUserId: "user_1",
      requestId: "ab12cd34",
      action: "DELETE",
      entityType: "TabRecord",
      entityId: "pat_1:personal",
      before: { status: "COMPLETE" },
      after: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user_1",
        requestId: "ab12cd34",
        after: null,
      }),
    });
  });

  it("writes via the passed-in transaction client, never a module-level prisma import", async () => {
    const { tx, create } = fakeTx();
    await writeAuditLog(tx, {
      facilityId: "fac_1",
      action: "CREATE",
      entityType: "User",
      entityId: "user_2",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
