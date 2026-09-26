import { describe, it, expect } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/server/http/errors";
import { AUTH_ERROR, sessionStaleError, wrongRoleError, researcherNotApprovedError } from "./errors";

describe("auth error factories", () => {
  it("sessionStaleError carries AUTH.SESSION_STALE", () => {
    const error = sessionStaleError();
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.detail).toBe(AUTH_ERROR.SESSION_STALE);
  });

  it("wrongRoleError carries AUTH.WRONG_ROLE with the given message", () => {
    const error = wrongRoleError("Admin access only.");
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.detail).toBe(AUTH_ERROR.WRONG_ROLE);
    expect(error.message).toBe("Admin access only.");
  });

  it("researcherNotApprovedError carries AUTH.RESEARCHER_NOT_APPROVED", () => {
    const error = researcherNotApprovedError();
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.detail).toBe(AUTH_ERROR.RESEARCHER_NOT_APPROVED);
  });
});
