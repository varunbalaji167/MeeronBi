import { describe, it, expect } from "vitest";
import { aggregate, aggregateTimeSeries } from "./aggregate";
import { AnalyticsFieldMeta, CohortDataset, STANDARD_SEGMENTS, TimeSeriesDataset } from "@/domain/analytics/types";
import { ANALYTICS_ERROR } from "./errors";

const HEIGHT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "heightCm" }, label: "Height", dataType: "ratio" };
const WEIGHT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "weightFirstVisitKg" }, label: "Weight", dataType: "ratio" };
const BLOOD_GROUP: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "investigation", fieldName: "bloodGroup" }, label: "Blood Group", dataType: "categorical" };
const DISTRICT: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "district" }, label: "District", dataType: "categorical" };
// standardSegmentKey lets the ratioNoFilter tests exercise real, predictable Standard Segment brackets.
const AGE: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "ageYears" }, label: "Age", dataType: "ratio", standardSegmentKey: "age" };
const TSH_GRID_FIELD: AnalyticsFieldMeta = {
  ref: { kind: "stored", tabKey: "investigation", fieldName: "tsh__gestAgeWeeks" },
  label: "TSH — Gest. Age",
  dataType: "ratio",
  multiValue: true,
};
// Carries `standardSegmentKey: "tsh"` — the field aggregateTimeSeries attaches STANDARD_SEGMENTS.tsh's reference band to.
const TSH_FIELD: AnalyticsFieldMeta = {
  ref: { kind: "stored", tabKey: "treatments", fieldName: "tsh" },
  label: "TSH (mU/L)",
  dataType: "ratio",
  multiValue: true,
  standardSegmentKey: "tsh",
};

const REGISTRY = [HEIGHT, WEIGHT, BLOOD_GROUP, DISTRICT, AGE, TSH_GRID_FIELD, TSH_FIELD];

function patient(patientId: string, tabs: Record<string, Record<string, any>>) {
  return { patientId, tabs };
}

describe("aggregate", () => {
  it("rejects a field that isn't in the registry", () => {
    const result = aggregate({ field: { kind: "stored", tabKey: "personal", fieldName: "nonsense" } }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FIELD);
  });

  it("rejects a filter field that isn't in the registry", () => {
    const result = aggregate(
      { field: HEIGHT.ref, filter: { kind: "stored", tabKey: "personal", fieldName: "nonsense" } },
      REGISTRY,
      [],
      "internal"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FILTER);
  });

  it("rejects the filter being the same field as what's being analyzed", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: HEIGHT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.SAME_FIELD_AS_FILTER);
  });

  it("rejects a multiValue (grid/repeating) field for cohort mode — it's time-series-only", () => {
    const result = aggregate({ field: TSH_GRID_FIELD.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("rejects a multiValue filter field the same way", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: TSH_GRID_FIELD.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("dispatches Ratio field + Ratio filter to the scatter branch", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: WEIGHT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.kind).toBe("ratioScatter");
  });

  it("dispatches Ratio field + Categorical filter to the ratio-by-category branch", () => {
    const result = aggregate({ field: HEIGHT.ref, filter: BLOOD_GROUP.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.kind).toBe("ratioByCategory");
  });

  it("dispatches Categorical field + Categorical filter to the cross-tab branch", () => {
    const result = aggregate({ field: BLOOD_GROUP.ref, filter: DISTRICT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.kind).toBe("categoryByCategory");
  });

  it("dispatches Categorical field + Ratio filter to the bucket-then-cross-tab branch", () => {
    const result = aggregate({ field: BLOOD_GROUP.ref, filter: HEIGHT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.kind).toBe("categoryByCategory");
  });

  describe("ratioNoFilter", () => {
    // 5 patients aged 22 (bracket "20-24 years"), 4 aged 32 ("30-34 years"), 1 aged 42 ("40-44 years").
    const dataset: CohortDataset = [
      ...[22, 22, 22, 22, 22].map((age, i) => patient(`p20-${i}`, { personal: { ageYears: age } })),
      ...[32, 32, 32, 32].map((age, i) => patient(`p30-${i}`, { personal: { ageYears: age } })),
      patient("p40-0", { personal: { ageYears: 42 } }),
    ];

    it("computes correct central tendencies and bucket counts over a real dataset", () => {
      const result = aggregate({ field: AGE.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "ratioSummary") throw new Error("expected a ratioSummary");

      expect(result.value.stats.count).toBe(10);
      expect(result.value.stats.min).toBe(22);
      expect(result.value.stats.max).toBe(42);
      expect(result.value.stats.average).toBeCloseTo((22 * 5 + 32 * 4 + 42) / 10, 10);
    });

    it("suppresses a rare bucket (below MIN_CELL_SIZE.internal = 5) into \"Other (suppressed)\", keeps a bucket exactly at the threshold", () => {
      const result = aggregate({ field: AGE.ref }, REGISTRY, dataset, "internal");
      if (!result.ok || result.value.kind !== "ratioSummary") throw new Error("expected a ratioSummary");

      const byLabel = Object.fromEntries(result.value.buckets.map((b) => [b.value, b]));
      // Exactly 5 — not below the threshold — stays visible as its own bucket.
      expect(byLabel["20-24 years"]).toMatchObject({ count: 5 });
      expect(byLabel["20-24 years"].suppressed).toBeUndefined();
      // 4 (30-34) + 1 (40-44) = 5, merged into one suppressed bucket; neither original bracket survives on its own.
      expect(byLabel["30-34 years"]).toBeUndefined();
      expect(byLabel["40-44 years"]).toBeUndefined();
      expect(byLabel["Other (suppressed)"]).toMatchObject({ count: 5, percent: 50, suppressed: true });
    });

    it("returns an all-zero/empty ratioSummary (not a partial or misleading one) when total sample size is below threshold", () => {
      const smallDataset: CohortDataset = [22, 23, 24].map((age, i) => patient(`p${i}`, { personal: { ageYears: age } }));
      const result = aggregate({ field: AGE.ref }, REGISTRY, smallDataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "ratioSummary") throw new Error("expected a ratioSummary");

      expect(result.value.stats).toEqual({ count: 0, average: 0, max: 0, min: 0, mode: null, standardDeviation: 0 });
      expect(result.value.buckets).toEqual([]);
    });
  });

  describe("categoryNoFilter", () => {
    // 6 O+, 3 A+, 1 B+, plus 2 patients with no investigation tab at all (dropped, not counted).
    const dataset: CohortDataset = [
      ...Array.from({ length: 6 }, (_, i) => patient(`o-${i}`, { investigation: { bloodGroup: "O+" } })),
      ...Array.from({ length: 3 }, (_, i) => patient(`a-${i}`, { investigation: { bloodGroup: "A+" } })),
      patient("b-0", { investigation: { bloodGroup: "B+" } }),
      patient("missing-0", {}),
      patient("missing-1", { investigation: {} }),
    ];

    it("computes correct counts/percents and merges small cells into \"Other (suppressed)\"", () => {
      const result = aggregate({ field: BLOOD_GROUP.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "categorySummary") throw new Error("expected a categorySummary");

      // Denominator is 10 (patients with a bloodGroup answered), not 12 — the 2 missing-tab patients are dropped, not counted.
      expect(result.value.breakdown).toEqual([
        { value: "O+", count: 6, percent: 60 },
        { value: "Other (suppressed)", count: 4, percent: 40, suppressed: true },
      ]);
    });
  });

  describe("ratioByRatio", () => {
    it("pairs height/weight per patient, dropping any patient missing either value", () => {
      const dataset: CohortDataset = [
        ...Array.from({ length: 5 }, (_, i) => patient(`p${i}`, { personal: { heightCm: 150 + i, weightFirstVisitKg: 50 + i } })),
        patient("no-weight", { personal: { heightCm: 160 } }),
        patient("no-height", { personal: { weightFirstVisitKg: 60 } }),
      ];

      const result = aggregate({ field: HEIGHT.ref, filter: WEIGHT.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "ratioScatter") throw new Error("expected a ratioScatter");

      expect(result.value.points).toEqual(
        Array.from({ length: 5 }, (_, i) => ({ x: 150 + i, y: 50 + i }))
      );
    });

    it("suppresses the whole scatter (empty points) below the minimum sample size", () => {
      const dataset: CohortDataset = Array.from({ length: 3 }, (_, i) => patient(`p${i}`, { personal: { heightCm: 150 + i, weightFirstVisitKg: 50 + i } }));

      const result = aggregate({ field: HEIGHT.ref, filter: WEIGHT.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "ratioScatter") throw new Error("expected a ratioScatter");
      expect(result.value.points).toEqual([]);
    });
  });

  describe("ratioByCategory", () => {
    it("computes per-group central tendencies, dropping groups below the minimum sample size", () => {
      const dataset: CohortDataset = [
        ...[150, 152, 154, 156, 158].map((h, i) => patient(`o-${i}`, { personal: { heightCm: h }, investigation: { bloodGroup: "O+" } })),
        // Only 2 A+ patients — below MIN_CELL_SIZE.internal (5), the whole group is dropped.
        ...[160, 162].map((h, i) => patient(`a-${i}`, { personal: { heightCm: h }, investigation: { bloodGroup: "A+" } })),
        // A patient with a height but no bloodGroup answer is dropped (no group to join).
        patient("no-group", { personal: { heightCm: 170 } }),
      ];

      const result = aggregate({ field: HEIGHT.ref, filter: BLOOD_GROUP.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "ratioByCategory") throw new Error("expected a ratioByCategory");

      expect(result.value.groups).toHaveLength(1);
      expect(result.value.groups[0].value).toBe("O+");
      expect(result.value.groups[0].stats.count).toBe(5);
      expect(result.value.groups[0].stats.average).toBeCloseTo((150 + 152 + 154 + 156 + 158) / 5, 10);
    });
  });

  describe("categoryByCategory", () => {
    // 6 O+/Imphal, 5 O+/Churachandpur, 1 A+/Imphal (below threshold — zeroed, not merged).
    const dataset: CohortDataset = [
      ...Array.from({ length: 6 }, (_, i) => patient(`oi-${i}`, { investigation: { bloodGroup: "O+" }, personal: { district: "Imphal" } })),
      ...Array.from({ length: 5 }, (_, i) => patient(`oc-${i}`, { investigation: { bloodGroup: "O+" }, personal: { district: "Churachandpur" } })),
      patient("ai-0", { investigation: { bloodGroup: "A+" }, personal: { district: "Imphal" } }),
    ];

    it("counts patients per (filterValue, fieldValue) pair, percent of the filter group's own total", () => {
      const result = aggregate({ field: BLOOD_GROUP.ref, filter: DISTRICT.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "categoryByCategory") throw new Error("expected a categoryByCategory");

      const churachandpurOPlus = result.value.cells.find((c) => c.filterValue === "Churachandpur" && c.value === "O+");
      expect(churachandpurOPlus).toMatchObject({ count: 5, percent: 100 });
    });

    it("zeroes (rather than merges) a cross-tab cell below the minimum sample size", () => {
      const result = aggregate({ field: BLOOD_GROUP.ref, filter: DISTRICT.ref }, REGISTRY, dataset, "internal");
      if (!result.ok || result.value.kind !== "categoryByCategory") throw new Error("expected a categoryByCategory");

      const imphalAPlus = result.value.cells.find((c) => c.filterValue === "Imphal" && c.value === "A+");
      expect(imphalAPlus).toMatchObject({ count: 0, percent: 0, suppressed: true });

      const imphalOPlus = result.value.cells.find((c) => c.filterValue === "Imphal" && c.value === "O+");
      expect(imphalOPlus).toMatchObject({ count: 6 });
      expect(imphalOPlus?.suppressed).toBeUndefined();
    });
  });

  describe("categoryByRatio", () => {
    it("buckets the ratio filter via bracketsForField, then cross-tabs on bracket labels", () => {
      // Reuses AGE's "age" Standard Segment so bracket labels are predictable: 5 in "20-24 years", 5 in "30-34 years".
      const dataset: CohortDataset = [
        ...Array.from({ length: 5 }, (_, i) => patient(`y-${i}`, { investigation: { bloodGroup: "O+" }, personal: { ageYears: 22 } })),
        ...Array.from({ length: 5 }, (_, i) => patient(`o-${i}`, { investigation: { bloodGroup: "A+" }, personal: { ageYears: 32 } })),
      ];

      const result = aggregate({ field: BLOOD_GROUP.ref, filter: AGE.ref }, REGISTRY, dataset, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok || result.value.kind !== "categoryByCategory") throw new Error("expected a categoryByCategory");

      expect(result.value.cells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filterValue: "20-24 years", value: "O+", count: 5, percent: 100 }),
          expect.objectContaining({ filterValue: "30-34 years", value: "A+", count: 5, percent: 100 }),
        ])
      );
    });
  });
});

describe("aggregateTimeSeries", () => {
  it("rejects a field that isn't in the registry", () => {
    const result = aggregateTimeSeries(
      { field: { kind: "stored", tabKey: "investigation", fieldName: "nonsense" } },
      REGISTRY,
      [],
      "internal"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.UNKNOWN_FIELD);
  });

  it("rejects a field that isn't multiValue — time-series is only for grid/repeating fields", () => {
    const result = aggregateTimeSeries({ field: HEIGHT.ref, patientId: "p1" }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("rejects a filter that isn't categorical (time-series cohort mode needs one line per category)", () => {
    const result = aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, filter: HEIGHT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE);
  });

  it("rejects patientId and filter both present — the two modes are mutually exclusive", () => {
    const result = aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, patientId: "p1", filter: DISTRICT.ref }, REGISTRY, [], "internal");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toBe(ANALYTICS_ERROR.TIME_SERIES_MODE_CONFLICT);
  });

  describe("single-patient mode", () => {
    it("buckets entries into the right trimester (including pre-pregnancy) and attaches the TSH reference band", () => {
      const data: TimeSeriesDataset = [
        {
          patientId: "p1",
          lmp: "2024-01-01",
          entries: [
            { value: 3.5, date: "2023-12-01" }, // before LMP -> prePregnancy
            { value: 2.5, date: "2024-02-01" }, // ~4 weeks -> t1
            { value: 3.0, date: "2024-05-01" }, // ~17 weeks -> t2
            { value: 2.8, date: "2024-08-01" }, // ~30 weeks -> t3
          ],
        },
      ];

      const result = aggregateTimeSeries({ field: TSH_FIELD.ref, patientId: "p1" }, REGISTRY, data, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");

      expect(result.value.series).toHaveLength(1);
      expect(result.value.series[0].label).toBe("TSH (mU/L)");

      const byBucket = Object.fromEntries(result.value.series[0].points.map((p) => [p.bucket, p]));
      expect(byBucket.prePregnancy).toMatchObject({
        value: 3.5,
        date: "2023-12-01",
        referenceLow: STANDARD_SEGMENTS.tsh.prePregnancy.min,
        referenceHigh: STANDARD_SEGMENTS.tsh.prePregnancy.max,
      });
      expect(byBucket.t1).toMatchObject({ value: 2.5, date: "2024-02-01", referenceLow: STANDARD_SEGMENTS.tsh.t1.min, referenceHigh: STANDARD_SEGMENTS.tsh.t1.max });
      expect(byBucket.t2).toMatchObject({ value: 3.0, date: "2024-05-01", referenceLow: STANDARD_SEGMENTS.tsh.t2.min, referenceHigh: STANDARD_SEGMENTS.tsh.t2.max });
      expect(byBucket.t3).toMatchObject({ value: 2.8, date: "2024-08-01", referenceLow: STANDARD_SEGMENTS.tsh.t3.min, referenceHigh: STANDARD_SEGMENTS.tsh.t3.max });
    });

    it("averages multiple entries landing in the same bucket, and omits `date` since no single date applies", () => {
      const data: TimeSeriesDataset = [
        {
          patientId: "p1",
          lmp: "2024-01-01",
          entries: [
            { value: 2.0, date: "2024-02-01" },
            { value: 4.0, date: "2024-02-15" },
          ],
        },
      ];

      const result = aggregateTimeSeries({ field: TSH_FIELD.ref, patientId: "p1" }, REGISTRY, data, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");

      expect(result.value.series[0].points).toEqual([
        { bucket: "t1", value: 3, referenceLow: STANDARD_SEGMENTS.tsh.t1.min, referenceHigh: STANDARD_SEGMENTS.tsh.t1.max },
      ]);
    });

    it("returns an empty series when the patient has no data", () => {
      const result = aggregateTimeSeries({ field: TSH_FIELD.ref, patientId: "p1" }, REGISTRY, [], "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      expect(result.value.series).toEqual([]);
    });

    it("doesn't attach a reference band for a multiValue field with no standardSegmentKey", () => {
      const data: TimeSeriesDataset = [{ patientId: "p1", lmp: "2024-01-01", entries: [{ value: 12, date: "2024-02-01" }] }];
      const result = aggregateTimeSeries({ field: TSH_GRID_FIELD.ref, patientId: "p1" }, REGISTRY, data, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      expect(result.value.series[0].points[0].referenceLow).toBeUndefined();
    });
  });

  describe("cohort mode", () => {
    it("averages per category and suppresses a category below the minimum sample size", () => {
      const data: TimeSeriesDataset = [
        ...Array.from({ length: 5 }, (_, i) => ({
          patientId: `imphal-${i}`,
          lmp: "2024-01-01",
          filterValue: "Imphal",
          entries: [{ value: 2 + i, date: "2024-02-01" }], // t1: 2,3,4,5,6 -> average 4
        })),
        // Only 3 Churachandpur patients — below MIN_CELL_SIZE.internal (5), the whole category is dropped.
        ...Array.from({ length: 3 }, (_, i) => ({
          patientId: `chura-${i}`,
          lmp: "2024-01-01",
          filterValue: "Churachandpur",
          entries: [{ value: 10, date: "2024-02-01" }],
        })),
      ];

      const result = aggregateTimeSeries({ field: TSH_FIELD.ref, filter: DISTRICT.ref }, REGISTRY, data, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");

      expect(result.value.series).toHaveLength(1);
      expect(result.value.series[0].label).toBe("Imphal");
      expect(result.value.series[0].points).toEqual([
        { bucket: "t1", value: 4, referenceLow: STANDARD_SEGMENTS.tsh.t1.min, referenceHigh: STANDARD_SEGMENTS.tsh.t1.max },
      ]);
    });

    it("suppresses one thin bucket point within an otherwise-kept category", () => {
      // 5 patients all with a t1 entry (meets the threshold); only 1 of them also has a t2 entry
      // (below threshold, so t2 is suppressed while t1 stays).
      const data: TimeSeriesDataset = Array.from({ length: 5 }, (_, i) => ({
        patientId: `p-${i}`,
        lmp: "2024-01-01",
        filterValue: "Imphal",
        entries: i === 0 ? [{ value: 2, date: "2024-02-01" }, { value: 5, date: "2024-05-01" }] : [{ value: 2, date: "2024-02-01" }],
      }));

      const result = aggregateTimeSeries({ field: TSH_FIELD.ref, filter: DISTRICT.ref }, REGISTRY, data, "internal");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");

      const buckets = result.value.series[0].points.map((p) => p.bucket);
      expect(buckets).toEqual(["t1"]);
    });
  });
});
