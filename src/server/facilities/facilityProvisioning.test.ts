import { describe, it, expect } from "vitest";
import { slugify, validateFacilityProvisioningInput } from "./facilityProvisioning";

describe("slugify", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugify("City General Hospital")).toBe("city-general-hospital");
  });

  it("collapses runs of punctuation/whitespace into a single hyphen", () => {
    expect(slugify("St. Mary's  --  Hospital")).toBe("st-mary-s-hospital");
  });

  it("strips diacritics rather than dropping the letter entirely", () => {
    expect(slugify("Ningthouja Médical Centre")).toBe("ningthouja-medical-centre");
  });

  it("trims leading/trailing hyphens left over from stripped punctuation", () => {
    expect(slugify("  (Regional) Hospital!  ")).toBe("regional-hospital");
  });
});

describe("validateFacilityProvisioningInput", () => {
  const validInput = {
    name: "City General Hospital",
    adminEmail: "admin@city-general.example.org",
    adminPassword: "ChangeMe123!",
  };

  it("auto-derives the slug from the name when none is given", () => {
    const result = validateFacilityProvisioningInput(validInput);
    expect(result.slug).toBe("city-general-hospital");
  });

  it("uses an explicit slug when given, lowercased and trimmed", () => {
    const result = validateFacilityProvisioningInput({ ...validInput, slug: " CGH-Main " });
    expect(result.slug).toBe("cgh-main");
  });

  it("normalizes the admin email to lowercase and trimmed", () => {
    const result = validateFacilityProvisioningInput({ ...validInput, adminEmail: "  Admin@City.Org  " });
    expect(result.adminEmail).toBe("admin@city.org");
  });

  it("rejects a blank facility name", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, name: "   " })).toThrowError(/fix the highlighted/i);
  });

  it("rejects an explicit slug with uppercase, spaces, or underscores", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, slug: "City General" })).toThrow();
    expect(() => validateFacilityProvisioningInput({ ...validInput, slug: "city_general" })).toThrow();
  });

  it("rejects the reserved \"hq\" slug — that facility is the admin home, never a real hospital", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, slug: "hq" })).toThrow();
  });

  it("rejects a facility name that would derive an empty/reserved slug", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, name: "!!!" })).toThrow();
  });

  it("rejects a missing admin email", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, adminEmail: "  " })).toThrow();
  });

  it("rejects an admin password shorter than 6 characters", () => {
    expect(() => validateFacilityProvisioningInput({ ...validInput, adminPassword: "abc12" })).toThrow();
  });

  it("collects every field error at once rather than stopping at the first", () => {
    try {
      validateFacilityProvisioningInput({ name: "", adminEmail: "", adminPassword: "" });
      expect.fail("expected validateFacilityProvisioningInput to throw");
    } catch (err: any) {
      expect(err.fieldErrors).toMatchObject({
        name: expect.any(String),
        adminEmail: expect.any(String),
        adminPassword: expect.any(String),
      });
    }
  });

  it("trims optional adminName, and omits it entirely when blank", () => {
    expect(validateFacilityProvisioningInput({ ...validInput, adminName: "  Dr. Singh  " }).adminName).toBe("Dr. Singh");
    expect(validateFacilityProvisioningInput({ ...validInput, adminName: "   " }).adminName).toBeUndefined();
  });
});
