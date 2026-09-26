import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { isPhoneValue, formatPhoneValue } from "@/domain/phone";
import { writeAuditLog } from "@/server/http/audit";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export interface ListPatientsParams {
  facilityId: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

/** The per-tab-status "include" shared by the list and detail views. */
const TAB_STATUS_INCLUDE = {
  personal: { select: { status: true } },
  history: { select: { status: true } },
  investigation: { select: { status: true } },
  ultrasound: { select: { status: true } },
  delivery: { select: { status: true } },
  robson: { select: { status: true } },
  treatments: { select: { status: true } },
} as const;

export async function listPatients({ facilityId, query, page = 1, pageSize = DEFAULT_PAGE_SIZE }: ListPatientsParams) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
  const q = query?.trim();

  const where = {
    facilityId,
    ...(q ? { OR: [{ fullName: { contains: q } }, { mrn: { contains: q } }, { contactNo: { contains: q } }] } : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: TAB_STATUS_INCLUDE,
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    patients,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

export interface CreatePatientInput {
  fullName: string;
  createdById: string;
  facilityId: string;
}

/** Creates a patient with only a name; MRD/contact are collected in the Personal tab and synced back by `syncPatientSummaryFromPersonal`. */
export async function createPatient({ fullName, createdById, facilityId }: CreatePatientInput) {
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        fullName,
        createdById,
        facilityId,
        // Create an empty draft Personal record so the tab shows "Draft" right away.
        personal: { create: { data: { fullName }, status: "DRAFT" } },
      },
    });
    await writeAuditLog(tx, {
      facilityId,
      actorUserId: createdById,
      action: "CREATE",
      entityType: "Patient",
      entityId: patient.id,
      after: patient,
    });
    return patient;
  });
}

/**
 * Syncs the denormalized Patient.fullName/mrn/contactNo columns from the Personal tab (the source of truth), called after every save.
 * MRD is unique per facility; on a conflict, name/phone still sync and the caller is told to warn the user rather than failing the whole save.
 */
export async function syncPatientSummaryFromPersonal(
  patientId: string,
  personalData: Record<string, any>,
  actorUserId?: string
): Promise<{ mrnConflict: boolean }> {
  const fullName =
    typeof personalData.fullName === "string" && personalData.fullName.trim()
      ? personalData.fullName.trim()
      : undefined;
  const mrn = typeof personalData.mrn === "string" ? personalData.mrn.trim() || null : undefined;
  const contactNo = isPhoneValue(personalData.contactNo) ? formatPhoneValue(personalData.contactNo) || null : undefined;

  const patch: Record<string, any> = {};
  if (fullName !== undefined) patch.fullName = fullName;
  if (mrn !== undefined) patch.mrn = mrn;
  if (contactNo !== undefined) patch.contactNo = contactNo;
  if (Object.keys(patch).length === 0) return { mrnConflict: false };

  async function updateAndAudit(tx: Prisma.TransactionClient, data: Record<string, any>) {
    const before = await tx.patient.findUnique({ where: { id: patientId } });
    const after = await tx.patient.update({ where: { id: patientId }, data });
    if (before) {
      await writeAuditLog(tx, {
        facilityId: after.facilityId,
        actorUserId,
        action: "UPDATE",
        entityType: "Patient",
        entityId: patientId,
        before,
        after,
      });
    }
    return after;
  }

  try {
    await prisma.$transaction((tx) => updateAndAudit(tx, patch));
    return { mrnConflict: false };
  } catch (err: any) {
    if (err?.code === "P2002" && mrn !== undefined) {
      const { mrn: _omit, ...rest } = patch;
      if (Object.keys(rest).length > 0) {
        await prisma.$transaction((tx) => updateAndAudit(tx, rest));
      }
      return { mrnConflict: true };
    }
    throw err;
  }
}

export async function getPatientById(id: string, facilityId: string) {
  return prisma.patient.findFirst({
    where: { id, facilityId },
    include: { user: { select: { email: true } } },
  });
}

/** `facilityId` is optional only for SUPER_ADMIN callers that already verified access another way; everyone else must pass it. */
export async function getPatientHeaderInfo(id: string, facilityId?: string) {
  return prisma.patient.findFirst({
    where: facilityId ? { id, facilityId } : { id },
    select: {
      id: true,
      fullName: true,
      mrn: true,
      contactNo: true,
      user: { select: { email: true } },
      ...TAB_STATUS_INCLUDE,
    },
  });
}

/**
 * Deletes a patient (tab records cascade via the DB) and their portal login, if any, deleted explicitly since the FK points the other way.
 * Caller must already have confirmed `id` belongs to their facility (via `requireAdminSessionForPatient`) — not re-checked here.
 */
export async function deletePatient(id: string, actorUserId?: string) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) return prisma.patient.delete({ where: { id } });

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.patient.delete({ where: { id } });
    await writeAuditLog(tx, {
      facilityId: patient.facilityId,
      actorUserId,
      action: "DELETE",
      entityType: "Patient",
      entityId: id,
      before: patient,
    });
    return result;
  });

  if (patient.userId) {
    await prisma.user.delete({ where: { id: patient.userId } }).catch(() => {});
  }
  return deleted;
}

export async function getFullPatientRecord(id: string, facilityId: string) {
  return prisma.patient.findFirst({
    where: { id, facilityId },
    include: {
      personal: true,
      history: true,
      investigation: true,
      ultrasound: true,
      delivery: true,
      robson: true,
      treatments: true,
    },
  });
}
