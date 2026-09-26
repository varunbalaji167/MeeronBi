import { describe, it, expect } from "vitest";
import { resolveAnalyticsScope } from "./analyticsService";

describe("resolveAnalyticsScope", () => {
  it("ADMIN is pinned to its own facility, at the internal disclosure threshold", () => {
    expect(resolveAnalyticsScope({ role: "ADMIN", facilityId: "facility-a" })).toEqual({
      facilityId: "facility-a",
      audience: "internal",
    });
  });

  it("SUPER_ADMIN sees every facility (no facilityId), at the internal disclosure threshold", () => {
    expect(resolveAnalyticsScope({ role: "SUPER_ADMIN", facilityId: "hq" })).toEqual({
      audience: "internal",
    });
    expect(resolveAnalyticsScope({ role: "SUPER_ADMIN", facilityId: "hq" }).facilityId).toBeUndefined();
  });

  it("RESEARCHER sees every facility, at the stricter researcher disclosure threshold", () => {
    expect(resolveAnalyticsScope({ role: "RESEARCHER", facilityId: "hq" })).toEqual({
      audience: "researcher",
    });
  });
});
