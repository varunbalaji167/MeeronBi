import { describe, it, expect } from "vitest";
import { buildAnalyticsAuditPayload, buildTimeSeriesAuditPayload, sampleSizeOf, timeSeriesSampleSizeOf } from "./auditPayload";
import { AnalyticsResult, CentralTendencies, TimeSeriesResult } from "./types";

const stats = (count: number): CentralTendencies => ({ count, average: 1, max: 1, min: 1, mode: null, standardDeviation: 0 });

describe("sampleSizeOf", () => {
  it("reads count off a ratioSummary", () => {
    const result: AnalyticsResult = { kind: "ratioSummary", stats: stats(12), buckets: [] };
    expect(sampleSizeOf(result)).toBe(12);
  });

  it("counts points off a ratioScatter", () => {
    const result: AnalyticsResult = {
      kind: "ratioScatter",
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    };
    expect(sampleSizeOf(result)).toBe(2);
  });

  it("sums per-group counts off a ratioByCategory", () => {
    const result: AnalyticsResult = {
      kind: "ratioByCategory",
      groups: [
        { value: "a", stats: stats(5) },
        { value: "b", stats: stats(7) },
      ],
    };
    expect(sampleSizeOf(result)).toBe(12);
  });

  it("sums breakdown counts off a categorySummary", () => {
    const result: AnalyticsResult = {
      kind: "categorySummary",
      breakdown: [
        { value: "yes", count: 8, percent: 80 },
        { value: "no", count: 2, percent: 20 },
      ],
    };
    expect(sampleSizeOf(result)).toBe(10);
  });

  it("sums cell counts off a categoryByCategory", () => {
    const result: AnalyticsResult = {
      kind: "categoryByCategory",
      cells: [
        { filterValue: "x", value: "yes", count: 3, percent: 30 },
        { filterValue: "x", value: "no", count: 7, percent: 70 },
      ],
    };
    expect(sampleSizeOf(result)).toBe(10);
  });
});

describe("buildAnalyticsAuditPayload", () => {
  it("carries only refs, scope, and count — never raw values", () => {
    const result: AnalyticsResult = {
      kind: "categorySummary",
      breakdown: [{ value: "some-patient-visible-value", count: 42, percent: 100 }],
    };

    const payload = buildAnalyticsAuditPayload({
      field: "stored:anc.bloodGroup",
      filter: null,
      scope: "facility-a",
      result,
    });

    expect(payload).toEqual({
      field: "stored:anc.bloodGroup",
      filter: null,
      scope: "facility-a",
      count: 42,
    });
    expect(Object.values(payload)).not.toContain("some-patient-visible-value");
  });
});

describe("timeSeriesSampleSizeOf", () => {
  it("sums point counts across every series", () => {
    const result: TimeSeriesResult = {
      series: [
        { label: "Imphal", points: [{ bucket: "t1", value: 2 }, { bucket: "t2", value: 3 }] },
        { label: "Churachandpur", points: [{ bucket: "t1", value: 4 }] },
      ],
    };
    expect(timeSeriesSampleSizeOf(result)).toBe(3);
  });

  it("is 0 for an empty result", () => {
    expect(timeSeriesSampleSizeOf({ series: [] })).toBe(0);
  });
});

describe("buildTimeSeriesAuditPayload", () => {
  it("carries only refs, scope, and count — never raw values", () => {
    const result: TimeSeriesResult = {
      series: [{ label: "some-patient-visible-value", points: [{ bucket: "t1", value: 99 }] }],
    };

    const payload = buildTimeSeriesAuditPayload({
      field: "stored:treatments.tsh",
      filter: "stored:personal.district",
      scope: "facility-a",
      result,
    });

    expect(payload).toEqual({
      field: "stored:treatments.tsh",
      filter: "stored:personal.district",
      scope: "facility-a",
      count: 1,
    });
    expect(Object.values(payload)).not.toContain("some-patient-visible-value");
  });
});
