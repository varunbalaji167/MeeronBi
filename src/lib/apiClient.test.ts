import { describe, it, expect } from "vitest";
import { ApiError, friendlyErrorMessage } from "./apiClient";

describe("friendlyErrorMessage", () => {
  it("uses a detail-specific message when one is registered, overriding the generic code-based message", () => {
    const err = new ApiError("Not signed in.", 401, "UNAUTHORIZED", undefined, "AUTH.SESSION_STALE");
    expect(friendlyErrorMessage(err, "fallback")).toContain("database reset/reseed");
  });

  it("falls back to the generic code-based message when no detail is registered", () => {
    const err = new ApiError("Not signed in.", 401, "UNAUTHORIZED");
    expect(friendlyErrorMessage(err, "fallback")).toBe("Your session has expired — please sign out and sign in again.");
  });

  it("still surfaces the server message for an unregistered detail on a FORBIDDEN error", () => {
    const err = new ApiError("Admin access only.", 403, "FORBIDDEN", undefined, "AUTH.WRONG_ROLE");
    expect(friendlyErrorMessage(err, "fallback")).toBe("Admin access only.");
  });
});
