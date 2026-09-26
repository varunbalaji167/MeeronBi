import { describe, it, expect } from "vitest";
import { computeAge, computeBmi, bucketTrimester } from "./derivedFields";

describe("computeAge", () => {
  it("computes completed years as of the delivery date when one is recorded", () => {
    expect(computeAge({ dob: "2000-06-15", dateOfDelivery: "2026-06-14" })).toBe(25); // one day short of the birthday
    expect(computeAge({ dob: "2000-06-15", dateOfDelivery: "2026-06-15" })).toBe(26);
  });

  it("falls back to EDD, then USG EDD, when there's no delivery date yet (still pregnant)", () => {
    expect(computeAge({ dob: "1995-01-01", edd: "2026-03-01" })).toBe(31);
    expect(computeAge({ dob: "1995-01-01", edd: null, usgEdd: "2026-03-01" })).toBe(31);
  });

  it("prefers dateOfDelivery over edd over usgEdd when more than one is present", () => {
    expect(computeAge({ dob: "1990-01-01", dateOfDelivery: "2026-01-01", edd: "2020-01-01", usgEdd: "2010-01-01" })).toBe(36);
  });

  it("returns null when dob is missing, or when none of the three reference dates are available", () => {
    expect(computeAge({ dob: null })).toBeNull();
    expect(computeAge({ dob: "1990-01-01" })).toBeNull();
  });

  it("returns null rather than a negative age when the reference date somehow predates dob", () => {
    expect(computeAge({ dob: "2020-01-01", edd: "2019-01-01" })).toBeNull();
  });
});

describe("computeBmi", () => {
  it("computes BMI from height and first-visit weight", () => {
    expect(computeBmi(160, 61.44)).toBe(24); // 61.44 / 1.6^2 = 24.0
  });

  it("returns null when either input is missing or non-positive", () => {
    expect(computeBmi(null, 60)).toBeNull();
    expect(computeBmi(160, null)).toBeNull();
    expect(computeBmi(0, 60)).toBeNull();
    expect(computeBmi(160, 0)).toBeNull();
  });
});

describe("bucketTrimester", () => {
  const lmp = "2026-01-01";

  it("buckets an entry before LMP as pre-pregnancy", () => {
    expect(bucketTrimester(lmp, "2025-12-01")).toBe("prePregnancy");
  });

  it("buckets weeks 1-13 as t1, 14-27 as t2, 28+ as t3", () => {
    expect(bucketTrimester(lmp, "2026-02-01")).toBe("t1"); // ~4-5 weeks
    expect(bucketTrimester(lmp, "2026-04-15")).toBe("t2"); // ~14-15 weeks
    expect(bucketTrimester(lmp, "2026-08-01")).toBe("t3"); // ~30 weeks
  });

  it("returns null when lmp or the entry date is missing/unparseable", () => {
    expect(bucketTrimester(null, "2026-02-01")).toBeNull();
    expect(bucketTrimester(lmp, "not a date")).toBeNull();
  });
});
