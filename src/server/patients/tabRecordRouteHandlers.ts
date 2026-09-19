import { NextResponse } from "next/server";
import { assertPatientRecordAccessible, requireAdminSessionForPatient } from "@/server/auth/guards";
import { isKnownTabKey, getTabRecord, saveTabRecord, deleteTabRecord } from "./tabRecordRepository";
import { syncPatientSummaryFromPersonal } from "./patientRepository";
import { getTabByKey } from "@/domain/tabs";
import { getIncompleteReasons, getFieldLevelErrors } from "@/domain/validation";
import { NotFoundError, ValidationError } from "@/server/http/errors";

/**
 * Thin HTTP adapters shared by every `/api/patients/[id]/{tab}/route.ts`
 * file — each of those 7 files is intentionally just three lines calling
 * into here (see one of them for the pattern). This is the ONE place that
 * translates "tab record CRUD" into HTTP status codes/JSON shape; the
 * actual data access lives in tabRecordRepository.ts, and access control in
 * server/auth/guards.ts. Keeping this layer thin and these three concerns
 * separate is what makes each of them individually easy to change.
 */

export async function handleTabGet(tabKey: string, patientId: string) {
  await assertPatientRecordAccessible(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  const record = await getTabRecord(tabKey, patientId);
  return NextResponse.json(record);
}

export async function handleTabSave(tabKey: string, patientId: string, req: Request) {
  // Only staff (ADMIN) may write data — patients are read-only viewers.
  // requireAdminSessionForPatient (not the plain requireAdminSession) also
  // confirms this patient belongs to the admin's own facility — see
  // server/auth/guards.ts.
  await requireAdminSessionForPatient(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  const body = await req.json();
  const data = body?.data ?? {};
  const status = body?.status === "COMPLETE" ? "COMPLETE" : "DRAFT";

  // Server-side enforcement, independent of the browser: the client runs
  // this same check for UX (instant feedback, no round trip), but a request
  // built by hand — bypassing the UI entirely — must not be able to mark a
  // tab Complete with missing required fields or invalid data. Drafts are
  // exempt by design; only the transition to COMPLETE is gated.
  if (status === "COMPLETE") {
    const tab = getTabByKey(tabKey)!; // isKnownTabKey already confirmed this exists
    const missing = getIncompleteReasons(tab, data);
    const fieldErrors = getFieldLevelErrors(tab, data);
    if (missing.length > 0 || Object.keys(fieldErrors).length > 0) {
      throw new ValidationError(`Can't mark complete: ${[...missing, ...Object.values(fieldErrors)].join("; ")}`, fieldErrors);
    }
  }

  // requireAdminSessionForPatient above already confirmed this patient
  // exists and is at the caller's facility — no need to re-check here.
  const record = await saveTabRecord(tabKey, patientId, data, status);

  // The Personal tab is the single source of truth for name/MRD/phone —
  // keep the patient-list's denormalized columns in sync every time it's
  // saved. An MRD conflict is reported as a field-level error (same shape
  // used above) so it shows up as red text under the MRD box, not a toast
  // that's easy to miss.
  let fieldErrors: Record<string, string> | undefined;
  if (tabKey === "personal") {
    const sync = await syncPatientSummaryFromPersonal(patientId, record.data);
    if (sync.mrnConflict) {
      fieldErrors = { mrn: "This CR No./MRD is already used by another patient at your facility — choose a different one." };
    }
  }

  return NextResponse.json({ ...record, fieldErrors });
}

export async function handleTabDelete(tabKey: string, patientId: string) {
  await requireAdminSessionForPatient(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  await deleteTabRecord(tabKey, patientId);
  return NextResponse.json({ ok: true });
}
