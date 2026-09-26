import { describe, it, expect } from "vitest";
import { centralTendencies } from "./statistics";

describe("centralTendencies", () => {
  it("computes count/average/max/min/mode/SD on a known set", () => {
    // mean = 4; population variance = ((2-4)^2 + 0 + 0 + 0 + (6-4)^2) / 5 = 1.6
    const result = centralTendencies([2, 4, 4, 4, 6]);
    expect(result.count).toBe(5);
    expect(result.average).toBe(4);
    expect(result.max).toBe(6);
    expect(result.min).toBe(2);
    expect(result.mode).toBe(4);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(1.6), 10);
  });

  it("returns mode = null when every distinct value is equally frequent (no value stands out)", () => {
    expect(centralTendencies([1, 2, 3]).mode).toBeNull();
    // Two values tied at the same higher frequency, covering every distinct value — still ambiguous.
    expect(centralTendencies([1, 1, 2, 2]).mode).toBeNull();
  });

  it("picks the smallest value among a genuine (partial) tie for most-frequent", () => {
    // 1 and 2 both occur twice, 3 occurs once — not every distinct value ties, so it's not the "all equal" case.
    expect(centralTendencies([1, 1, 2, 2, 3]).mode).toBe(1);
  });

  it("handles a single-value set without treating it as an ambiguous tie", () => {
    const result = centralTendencies([7]);
    expect(result).toEqual({ count: 1, average: 7, max: 7, min: 7, mode: 7, standardDeviation: 0 });
  });

  it("returns an all-zero/null result for empty input instead of NaN", () => {
    expect(centralTendencies([])).toEqual({ count: 0, average: 0, max: 0, min: 0, mode: null, standardDeviation: 0 });
  });
});
