import { describe, it, expect } from "vitest";
import { getAnalyticsFieldRegistry } from "./fieldRegistry";
import { FieldRef } from "./types";

const registry = getAnalyticsFieldRegistry();

function findByRef(predicate: (ref: FieldRef) => boolean) {
  return registry.filter((m) => predicate(m.ref));
}

describe("getAnalyticsFieldRegistry", () => {
  it("classifies a plain number field as ratio, carrying its unit from the cm/kg naming convention", () => {
    const height = findByRef((r) => r.kind === "stored" && r.fieldName === "heightCm");
    expect(height).toHaveLength(1);
    expect(height[0].dataType).toBe("ratio");
    expect(height[0].unit).toBe("cm");

    const weight = findByRef((r) => r.kind === "stored" && r.fieldName === "weightFirstVisitKg");
    expect(weight[0].unit).toBe("kg");
  });

  it("classifies a plain select/radio field as categorical without exploding it", () => {
    const bloodGroup = findByRef((r) => r.kind === "stored" && r.fieldName === "bloodGroup");
    expect(bloodGroup).toHaveLength(1);
    expect(bloodGroup[0].dataType).toBe("categorical");
  });

  it("explodes a multiselect field into one boolean-categorical entry per option, so no entry can exceed 100%", () => {
    const oicMethod = findByRef((r) => r.kind === "multiselectOption" && r.fieldName === "oicMethod");
    expect(oicMethod).toHaveLength(5);
    expect(oicMethod.every((m) => m.dataType === "categorical")).toBe(true);
    expect(oicMethod.map((m) => (m.ref as any).option)).toEqual(["Clomiphene", "FSH", "HMG", "Letrozole", "Gonadotropins"]);
  });

  it("excludes date fields entirely — they only feed derived fields or the time-series axis", () => {
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "dob")).toHaveLength(0);
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "lmp")).toHaveLength(0);
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "edd")).toHaveLength(0);
  });

  it("excludes free-text and phone fields (not summarizable, or PII)", () => {
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "fullName")).toHaveLength(0);
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "contactNo")).toHaveLength(0);
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "additionalRemarks")).toHaveLength(0);
  });

  it("flattens a grid section's row x column combination into one field per cell, using the same row__col storage key the form uses", () => {
    const tshGestAge = findByRef((r) => r.kind === "stored" && r.fieldName === "tsh__gestAgeWeeks");
    expect(tshGestAge).toHaveLength(1);
    expect(tshGestAge[0].dataType).toBe("ratio");
    expect(tshGestAge[0].multiValue).toBe(true);

    // The grid's "level" column is free text — still excluded even inside a grid.
    expect(findByRef((r) => r.kind === "stored" && r.fieldName === "tsh__level")).toHaveLength(0);
  });

  it("flags a grid's radio-result column as categorical and multiValue, per-row (VDRL, HCV Ab, HbSAg, HIV each get their own field)", () => {
    const vdrl = findByRef((r) => r.kind === "stored" && r.fieldName === "vdrl__result");
    expect(vdrl).toHaveLength(1);
    expect(vdrl[0].dataType).toBe("categorical");
    expect(vdrl[0].multiValue).toBe(true);
  });

  it("flags a repeating section's fields as multiValue (a patient can have more than one Obstetric History entry)", () => {
    const weight1 = findByRef((r) => r.kind === "stored" && r.fieldName === "weight1Kg");
    expect(weight1).toHaveLength(1);
    expect(weight1[0].dataType).toBe("ratio");
    expect(weight1[0].multiValue).toBe(true);
  });

  it("does not flag an ordinary plain-section field as multiValue", () => {
    const bloodGroup = findByRef((r) => r.kind === "stored" && r.fieldName === "bloodGroup");
    expect(bloodGroup[0].multiValue).toBeUndefined();
  });

  it("includes the derived age and bmi fields, each carrying their Standard Segment key", () => {
    const age = findByRef((r) => r.kind === "derived" && r.id === "age");
    const bmi = findByRef((r) => r.kind === "derived" && r.id === "bmi");
    expect(age).toHaveLength(1);
    expect(age[0].standardSegmentKey).toBe("age");
    expect(bmi).toHaveLength(1);
    expect(bmi[0].standardSegmentKey).toBe("bmi");
  });
});
