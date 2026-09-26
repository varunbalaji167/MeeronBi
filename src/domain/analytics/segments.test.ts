import { describe, it, expect } from "vitest";
import { generateHistogramBrackets, bracketsForField, assignBracket, segmentedBreakdown } from "./segments";
import { AnalyticsFieldMeta, STANDARD_SEGMENTS } from "./types";

const ageMeta: AnalyticsFieldMeta = { ref: { kind: "derived", id: "age" }, label: "Age", dataType: "ratio", standardSegmentKey: "age" };
const heightMeta: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "personal", fieldName: "heightCm" }, label: "Height", dataType: "ratio", standardSegmentKey: "heightCm" };
const noSegmentMeta: AnalyticsFieldMeta = { ref: { kind: "stored", tabKey: "investigation", fieldName: "haemoglobin" }, label: "Haemoglobin", dataType: "ratio" };

describe("bracketsForField / assignBracket — Standard Segments", () => {
  it("lands a value in the right Standard Segment bracket (age 30 → \"30-34 years\")", () => {
    const brackets = bracketsForField(ageMeta, [28, 30, 33]);
    expect(brackets).toBe(STANDARD_SEGMENTS.age);
    const index = assignBracket(30, brackets);
    expect(brackets[index].label).toBe("30-34 years");
  });

  it("assigns an open-ended \"and below\" bracket (heightCm < 145)", () => {
    const brackets = bracketsForField(heightMeta, [140, 150, 175]);
    const index = assignBracket(140, brackets);
    expect(brackets[index].label).toBe("Very Short / Higher Risk");
  });

  it("assigns an open-ended \"and above\" bracket (heightCm >= 170)", () => {
    const brackets = bracketsForField(heightMeta, [140, 150, 175]);
    const index = assignBracket(175, brackets);
    expect(brackets[index].label).toBe("Tall");
  });

  it("returns -1 for a value outside every bracket", () => {
    const brackets = bracketsForField(ageMeta, [30]);
    expect(assignBracket(15, brackets)).toBe(-1);
  });

  it("falls back to a generated histogram when the field has no standardSegmentKey", () => {
    const values = [10, 11, 12, 13, 14];
    const brackets = bracketsForField(noSegmentMeta, values);
    expect(brackets).toEqual(generateHistogramBrackets(values));
    expect(brackets).not.toBe(STANDARD_SEGMENTS.age);
  });
});

describe("generateHistogramBrackets", () => {
  it("builds equal-width bins spanning [min, max] with readable labels", () => {
    const brackets = generateHistogramBrackets([20, 21, 22, 23, 23.6], 4);
    expect(brackets).toHaveLength(4);
    expect(brackets[0].min).toBeCloseTo(20, 10);
    expect(brackets[0].label).toBe("20.0–20.9");
    expect(brackets[3].max).toBeCloseTo(23.6, 10); // last bin's upper edge is exactly max, not drifted by float math
  });

  it("does not throw on empty input — returns no brackets", () => {
    expect(generateHistogramBrackets([])).toEqual([]);
  });

  it("does not throw on all-equal input — collapses to a single bracket", () => {
    const brackets = generateHistogramBrackets([5, 5, 5]);
    expect(brackets).toEqual([{ label: "5.0", min: 5, max: 5 }]);
  });
});

describe("segmentedBreakdown", () => {
  it("counts values per bracket and computes percent of the total", () => {
    const brackets = STANDARD_SEGMENTS.age;
    const values = [22, 23, 31, 31, 42]; // 2x 20-24, 2x 30-34, 1x 40-44
    const result = segmentedBreakdown(values, brackets);
    const byLabel = Object.fromEntries(result.map((r) => [r.value, r]));
    expect(byLabel["20-24 years"]).toMatchObject({ count: 2, percent: 40 });
    expect(byLabel["30-34 years"]).toMatchObject({ count: 2, percent: 40 });
    expect(byLabel["40-44 years"]).toMatchObject({ count: 1, percent: 20 });
    expect(byLabel["25-29 years"]).toMatchObject({ count: 0, percent: 0 });
    // Every entry carries its own bracket definition.
    expect(byLabel["30-34 years"].bracket).toEqual({ label: "30-34 years", min: 30, max: 34 });
  });

  it("does not throw on empty input", () => {
    expect(segmentedBreakdown([], STANDARD_SEGMENTS.age)).toHaveLength(STANDARD_SEGMENTS.age.length);
  });
});
