import { describe, it, expect } from "vitest";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import { PATIENT_ERROR, mrdDuplicateError, patientNotFoundInFacilityError, tabAlreadyCompleteNoChangeError } from "./errors";

describe("patient error factories", () => {
  it("mrdDuplicateError carries PATIENT.MRD_DUPLICATE with a mrn fieldError", () => {
    const error = mrdDuplicateError();
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.detail).toBe(PATIENT_ERROR.MRD_DUPLICATE);
    expect(error.fieldErrors?.mrn).toBeTruthy();
  });

  it("patientNotFoundInFacilityError carries PATIENT.NOT_FOUND_IN_FACILITY", () => {
    const error = patientNotFoundInFacilityError();
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.detail).toBe(PATIENT_ERROR.NOT_FOUND_IN_FACILITY);
  });

  it("tabAlreadyCompleteNoChangeError carries TAB.ALREADY_COMPLETE_NO_CHANGE with no fieldErrors", () => {
    const error = tabAlreadyCompleteNoChangeError();
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.detail).toBe(PATIENT_ERROR.TAB_ALREADY_COMPLETE_NO_CHANGE);
    expect(error.fieldErrors).toBeUndefined();
  });
});
