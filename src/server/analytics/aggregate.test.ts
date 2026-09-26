import { describe, it, expect } from "vitest";
import { aggregate, aggregateTimeSeries } from "./aggregate";
import { AnalyticsFieldMeta } from "@/domain/analytics/types";
import { ANALYTICS_ERROR } from "./errors";

const HEIGHT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "heightCm" }, label: "Height", dataType: "ratio" };
const WEIGHT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "weightFirstVisitKg" }, label: "Weight", dataType: "ratio" };
const BLOOD_GROUP: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "investigation", fieldName: "bloodGroup" }, label: "Blood Group", dataType: "categorical" };
const DISTRICT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "district" }, label: "District", dataType: "categorical" };
const TSH_GRID_FIELD: AnalyticsFieldMeta = {
  ref: { kind: "stored", tabKey: "investigation", fieldName: "tsh__gestAgeWeeks" },
  label: "TSH — Gest. Age",
  dataType: "ratio",
  multiValue: true,
};

const REGISTRY = [HEIGHT, WEIGHT, BLOOD_GROUP, DISTRICT, TSH_GRID_FIELD];

describe("aggregate", () => {
  it("rejects a field that isn't in the registry", () => {
    const result = aggregate({ field: { kind: "stored", tabKey: "personal", fieldName: "nonsense" } }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FIELD);
  });

  it("rejects a filter field that isn't in the registry", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: { kind: "stored", tabKey: "personal", fieldName: "nonsense" } }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FILTER);
  });

  it("rejects the filter being the same field as what's being analyzed", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: HEIGHT.ref }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.SAME_FIELD_AS_FILTER);
  });

  it("rejects a multiValue (grid/repeating) field for cohort mode — it's time-series-only", () => {
    const result = aggregate({ field: TSH_GRID_FIELD.ref }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("rejects a multiValue filter field the same way", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: TSH_GRID_FIELD.ref }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("dispatches a validated Ratio field with no filter to the ratio-summary branch (not yet implemented)", () => {
    expect(() => aggregate({ field: HEIGHT.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("dispatches Ratio field + Ratio filter to the scatter branch (not yet implemented)", () => {
    expect(() => aggregate({ field: HEIGHT.ref, filter: WEIGHT.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("dispatches Ratio field + Categorical filter to the ratio-by-category branch (not yet implemented)", () => {
    expect(() => aggregate({ field: HEIGHT.ref, filter: BLOOD_GROUP.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("dispatches a validated Categorical field with no filter to the category-summary branch (not yet implemented)", () => {
    expect(() => aggregate({ field: BLOOD_GROUP.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("dispatches Categorical field + Categorical filter to the cross-tab branch (not yet implemented)", () => {
    expect(() => aggregate({ field: BLOOD_GROUP.ref, filter: DISTRICT.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("dispatches Categorical field + Ratio filter to the bucket-then-cross-tab branch (not yet implemented)", () => {
    expect(() => aggregate({ field: BLOOD_GROUP.ref, filter: HEIGHT.ref }, REGISTRY)).toThrow("not yet implemented");
  });
});

describe("aggregateTimeSeries", () => {
  it("rejects a field that isn't in the registry", () => {
    const result = aggregateTimeSeries({ field: { kind: "stored", tabKey: "investigation", fieldName: "nonsense" } }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FIELD);
  });

  it("rejects a filter that isn't categorical (time-series cohort mode needs one line per category)", () => {
    const result = aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, filter: HEIGHT.ref }, REGISTRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("accepts a valid multiValue field with a categorical filter and reaches the not-yet-implemented body", () => {
    expect(() => aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, filter: DISTRICT.ref }, REGISTRY)).toThrow("not yet implemented");
  });

  it("accepts a valid single-patient query (no filter) and reaches the not-yet-implemented body", () => {
    expect(() => aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, patientId: "p1" }, REGISTRY)).toThrow("not yet implemented");
  });
});
