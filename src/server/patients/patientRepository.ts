import { prisma } from "@/server/db/prisma";
import { isPhoneValue, formatPhoneValue } from "@/domain/phone";

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

/**
 * A patient is created with ONLY a name. MRD and contact number are
 * deliberately not asked here — they're collected exactly once, in the
 * Personal tab, and synced back onto this row by
 * `syncPatientSummaryFromPersonal()` below whenever that tab is saved. This
 * used to ask for name/MRD/phone again at creation time, which meant
 * editing them later (in the Personal tab) silently didn't update what the
 * patient list showed. See docs/ARCHITECTURE.md for the full rationale.
 */
export async function createPatient({ fullName, createdById, facilityId }: CreatePatientInput) {
  return prisma.patient.create({
    data: {
      fullName,
      createdById,
      facilityId,
      // Immediately create an (empty) draft Personal record so the tab
      // shows a "Draft" badge right away instead of "—".
      personal: { create: { data: { fullName }, status: "DRAFT" } },
    },
  });
}

/**
 * Keeps the denormalized Patient.fullName/mrn/contactNo columns (used only
 * for the patient list's display + search) in sync with whatever was just
 * saved in the Personal tab, which is the single source of truth for this
 * data. Called after every Personal tab save — see
 * server/patients/tabRecordRouteHandlers.ts.
 *
 * MRD has a uniqueness constraint scoped per facility (two different
 * hospitals may both use "MRD-001" — see the `@@unique([facilityId, mrn])`
 * on Patient in schema.prisma); if two patients AT THE SAME FACILITY end up
 * with the same MRD, the *rest* of the sync (name, phone) still succeeds —
 * only the MRD column is left as-is, and the caller is told so it can warn
 * the person saving, rather than the whole save failing over a
 * display-only field.
 */
export async function syncPatientSummaryFromPersonal(
  patientId: string,
  personalData: Record<string, any>
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

  try {
    await prisma.patient.update({ where: { id: patientId }, data: patch });
    return { mrnConflict: false };
  } catch (err: any) {
    if (err?.code === "P2002" && mrn !== undefined) {
      const { mrn: _omit, ...rest } = patch;
      if (Object.keys(rest).length > 0) {
        await prisma.patient.update({ where: { id: patientId }, data: rest });
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

export async function getPatientHeaderInfo(id: string, facilityId: string) {
  return prisma.patient.findFirst({
    where: { id, facilityId },
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
 * Deletes a patient and everything attached to them: all 7 tab records
 * (cascade-deleted by the database — see the `onDelete: Cascade` on each
 * tab model in schema.prisma), and their portal login if they have one.
 * The login has to be cleaned up explicitly here rather than via a cascade
 * rule, since the foreign key points the other way (Patient -> User); the
 * Patient row is deleted first so nothing still references the User row
 * before it's removed.
 *
 * Callers must already have confirmed `id` belongs to the caller's facility
 * (via `requireAdminSessionForPatient` — see server/auth/guards.ts) before
 * calling this; it doesn't re-check, since `deleteMany` scoped by facility
 * would otherwise silently no-op on a cross-facility id instead of the
 * caller getting a clear NotFoundError earlier.
 */
export async function deletePatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { userId: true } });
  const deleted = await prisma.patient.delete({ where: { id } });
  if (patient?.userId) {
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
