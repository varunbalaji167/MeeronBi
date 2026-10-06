// Namespaced `detail` codes for patient/tab-record errors — same pattern as server/analytics/errors.ts.

import { ConflictError, NotFoundError } from "@/server/http/errors";

export const PATIENT_ERROR = {
  MRD_DUPLICATE: "PATIENT.MRD_DUPLICATE",
  NOT_FOUND_IN_FACILITY: "PATIENT.NOT_FOUND_IN_FACILITY",
  TAB_ALREADY_COMPLETE_NO_CHANGE: "TAB.ALREADY_COMPLETE_NO_CHANGE",
} as const;

/** Reserved; current MRD conflicts surface via a `{ mrnConflict }` flag on the save response. */
export function mrdDuplicateError(): ConflictError {
  return new ConflictError(
    "This CR No./MRD is already used by another patient at your facility.",
    { mrn: "Already used by another patient at your facility." },
    PATIENT_ERROR.MRD_DUPLICATE
  );
}

export function patientNotFoundInFacilityError(): NotFoundError {
  return new NotFoundError("Patient not found.", PATIENT_ERROR.NOT_FOUND_IN_FACILITY);
}

/** Reserved; no caller detects "Mark Complete with no changes" yet. */
export function tabAlreadyCompleteNoChangeError(): ConflictError {
  return new ConflictError(
    "This tab is already marked complete, with no changes to save.",
    undefined,
    PATIENT_ERROR.TAB_ALREADY_COMPLETE_NO_CHANGE
  );
}
