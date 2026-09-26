import { describe, it, expect } from "vitest";
import { resolvePatientListScope } from "./patientScope";

describe("resolvePatientListScope", () => {
  it("ADMIN always resolves to its own facility, ignoring a requested one", () => {
    expect(resolvePatientListScope({ role: "ADMIN", facilityId: "facility-a" }, "facility-b")).toBe("facility-a");
    expect(resolvePatientListScope({ role: "ADMIN", facilityId: "facility-a" })).toBe("facility-a");
  });

  it("SUPER_ADMIN with no requested facility resolves to undefined (all facilities)", () => {
    expect(resolvePatientListScope({ role: "SUPER_ADMIN", facilityId: "hq" })).toBeUndefined();
  });

  it("SUPER_ADMIN with a requested facility resolves to that facility", () => {
    expect(resolvePatientListScope({ role: "SUPER_ADMIN", facilityId: "hq" }, "facility-b")).toBe("facility-b");
  });
});
