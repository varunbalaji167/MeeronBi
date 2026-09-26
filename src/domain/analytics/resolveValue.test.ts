import { describe, it, expect } from "vitest";
import { resolveRatioValue, resolveCategoricalValue, PatientTabs } from "./resolveValue";
import { FieldRef } from "./types";

describe("resolveRatioValue", () => {
  it("parses a stored numeric field", () => {
    const ref: FieldRef = { kind: "stored", tabKey: "investigation", fieldName: "haemoglobin" };
    const tabs: PatientTabs = { investigation: { haemoglobin: 11.2 } };
    expect(resolveRatioValue(ref, tabs)).toBe(11.2);
  });

  it("rejects junk (non-numeric strings, missing field) → null", () => {
    const ref: FieldRef = { kind: "stored", tabKey: "investigation", fieldName: "haemoglobin" };
    expect(resolveRatioValue(ref, { investigation: { haemoglobin: "not a number" } })).toBeNull();
    expect(resolveRatioValue(ref, { investigation: {} })).toBeNull();
    expect(resolveRatioValue(ref, {})).toBeNull();
  });

  it("rejects an empty string rather than coercing it to 0", () => {
    const ref: FieldRef = { kind: "stored", tabKey: "investigation", fieldName: "haemoglobin" };
    expect(resolveRatioValue(ref, { investigation: { haemoglobin: "" } })).toBeNull();
  });

  it("computes derived age from the personal tab, falling back through edd/usgEdd when there's no delivery date", () => {
    const ref: FieldRef = { kind: "derived", id: "age" };
    const tabs: PatientTabs = {
      personal: { dob: "1996-01-15", edd: "2024-01-15", usgEdd: "2024-01-10" },
      delivery: {},
    };
    // No dateOfDelivery present, so it falls back to edd (2024-01-15) → 28 completed years, matching computeAge's own contract.
    expect(resolveRatioValue(ref, tabs)).toBe(28);
  });

  it("computes derived age using the delivery tab's dateOfDelivery when present, over edd/usgEdd", () => {
    const ref: FieldRef = { kind: "derived", id: "age" };
    const tabs: PatientTabs = {
      personal: { dob: "1996-01-15", edd: "2024-01-15" },
      delivery: { dateOfDelivery: "2023-12-01" },
    };
    expect(resolveRatioValue(ref, tabs)).toBe(27);
  });

  it("computes derived bmi from the personal tab's height and first-visit weight", () => {
    const ref: FieldRef = { kind: "derived", id: "bmi" };
    const tabs: PatientTabs = { personal: { heightCm: 160, weightFirstVisitKg: 61.5 } };
    expect(resolveRatioValue(ref, tabs)).toBe(24) ;
  });

  it("returns null for derived fields when the personal tab is entirely missing", () => {
    expect(resolveRatioValue({ kind: "derived", id: "age" }, {})).toBeNull();
    expect(resolveRatioValue({ kind: "derived", id: "bmi" }, {})).toBeNull();
  });

  it("a multiselectOption ref is not ratio-resolvable — always null", () => {
    const ref: FieldRef = { kind: "multiselectOption", tabKey: "history", fieldName: "medicalHistory", option: "GDM" };
    expect(resolveRatioValue(ref, { history: { medicalHistory: ["GDM"] } })).toBeNull();
  });
});

describe("resolveCategoricalValue", () => {
  it("returns the stored string value", () => {
    const ref: FieldRef = { kind: "stored", tabKey: "delivery", fieldName: "deliveryMode" };
    expect(resolveCategoricalValue(ref, { delivery: { deliveryMode: "Cesarean" } })).toBe("Cesarean");
  });

  it("returns null for a missing/non-string stored value", () => {
    const ref: FieldRef = { kind: "stored", tabKey: "delivery", fieldName: "deliveryMode" };
    expect(resolveCategoricalValue(ref, { delivery: {} })).toBeNull();
    expect(resolveCategoricalValue(ref, {})).toBeNull();
  });

  it("derived fields are never categorical — always null", () => {
    expect(resolveCategoricalValue({ kind: "derived", id: "age" }, { personal: { dob: "1990-01-01" } })).toBeNull();
  });

  describe("multiselectOption — the absent-vs-present-not-chosen rule", () => {
    const gdmRef: FieldRef = { kind: "multiselectOption", tabKey: "history", fieldName: "pregnancyComplications", option: "GDM" };
    const pihRef: FieldRef = { kind: "multiselectOption", tabKey: "history", fieldName: "pregnancyComplications", option: "PIH" };

    it("resolves \"Yes\" when the option is present in the stored array", () => {
      const tabs: PatientTabs = { history: { pregnancyComplications: ["GDM", "PIH"] } };
      expect(resolveCategoricalValue(gdmRef, tabs)).toBe("Yes");
    });

    it("resolves \"No\" when the field is present but doesn't include this option — the patient was still asked", () => {
      const tabs: PatientTabs = { history: { pregnancyComplications: ["Anemia"] } };
      expect(resolveCategoricalValue(gdmRef, tabs)).toBe("No");
    });

    it("resolves null (not counted) when the field itself is absent — the patient wasn't asked, not \"asked and said no\"", () => {
      expect(resolveCategoricalValue(gdmRef, { history: {} })).toBeNull();
      expect(resolveCategoricalValue(gdmRef, {})).toBeNull();
    });

    it("a patient with two conditions contributes \"Yes\" to each option's own field independently — not a double-count within one field", () => {
      const tabs: PatientTabs = { history: { pregnancyComplications: ["GDM", "PIH"] } };
      expect(resolveCategoricalValue(gdmRef, tabs)).toBe("Yes");
      expect(resolveCategoricalValue(pihRef, tabs)).toBe("Yes");
      // Each is a separate boolean sub-field (per fieldRegistry.ts's multiselect-explosion rule), so
      // this patient can be "Yes" in both %-Yes tallies at once without either one exceeding 100%.
    });

    it("treats malformed (non-array) data as unresolvable rather than guessing", () => {
      const tabs: PatientTabs = { history: { pregnancyComplications: "GDM" } };
      expect(resolveCategoricalValue(gdmRef, tabs)).toBeNull();
    });
  });
});
