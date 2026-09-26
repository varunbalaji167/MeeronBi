import { z } from "zod";
import { NextResponse } from "next/server";
import { assertPatientRecordAccessible, requireAdminSessionForPatient } from "@/server/auth/guards";
import { isKnownTabKey, getTabRecord, saveTabRecord, deleteTabRecord } from "./tabRecordRepository";
import { syncPatientSummaryFromPersonal } from "./patientRepository";
import { getTabByKey } from "@/domain/tabs";
import { getIncompleteReasons, getFieldLevelErrors } from "@/domain/validation";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { parseJson } from "@/server/http/parseJson";

// Shape-only check: `data`'s field-by-field content is sanitized by sanitizeTabData
// inside saveTabRecord, per CLAUDE.md rule 3 — this just rejects a malformed body
// (wrong type for `data`/`status`) before it reaches that layer.
const tabSaveBodySchema = z.object({
  data: z.record(z.unknown()),
  status: z.enum(["DRAFT", "COMPLETE"]).optional(),
});

/** Thin HTTP adapters shared by every `/api/patients/[id]/{tab}/route.ts`; data access lives in tabRecordRepository.ts, auth in guards.ts. */

export async function handleTabGet(tabKey: string, patientId: string) {
  await assertPatientRecordAccessible(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  const record = await getTabRecord(tabKey, patientId);
  return NextResponse.json(record);
}

export async function handleTabSave(tabKey: string, patientId: string, req: Request) {
  // Only staff (ADMIN) may write; this also confirms the patient belongs to the admin's own facility.
  const session = await requireAdminSessionForPatient(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  const body = await parseJson(req, tabSaveBodySchema);
  const data = body.data;
  const status = body.status === "COMPLETE" ? "COMPLETE" : "DRAFT";

  // Server-side enforcement: a hand-built request must not mark a tab COMPLETE with missing/invalid data. Drafts are exempt.
  if (status === "COMPLETE") {
    const tab = getTabByKey(tabKey)!; // isKnownTabKey already confirmed this exists
    const missing = getIncompleteReasons(tab, data);
    const fieldErrors = getFieldLevelErrors(tab, data);
    if (missing.length > 0 || Object.keys(fieldErrors).length > 0) {
      throw new ValidationError(`Can't mark complete: ${[...missing, ...Object.values(fieldErrors)].join("; ")}`, fieldErrors);
    }
  }

  const record = await saveTabRecord(tabKey, patientId, data, status, session.user.id);

  // Keep the patient-list's denormalized columns in sync with the Personal tab; report an MRD conflict as a field-level error.
  let fieldErrors: Record<string, string> | undefined;
  if (tabKey === "personal") {
    const sync = await syncPatientSummaryFromPersonal(patientId, record.data, session.user.id);
    if (sync.mrnConflict) {
      fieldErrors = { mrn: "This CR No./MRD is already used by another patient at your facility — choose a different one." };
    }
  }

  return NextResponse.json({ ...record, fieldErrors });
}

export async function handleTabDelete(tabKey: string, patientId: string) {
  const session = await requireAdminSessionForPatient(patientId);
  if (!isKnownTabKey(tabKey)) throw new NotFoundError("Unknown tab.");

  await deleteTabRecord(tabKey, patientId, session.user.id);
  return NextResponse.json({ ok: true });
}
