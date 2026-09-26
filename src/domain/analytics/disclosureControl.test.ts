import { describe, it, expect } from "vitest";
import { suppressSmallCells, suppressSmallCrossTabCells, meetsMinimumSampleSize, MIN_CELL_SIZE } from "./disclosureControl";
import { CategoricalBreakdown, CrossTabCell } from "./types";

describe("suppressSmallCells", () => {
  const entries: CategoricalBreakdown[] = [
    { value: "Imphal West", count: 43, percent: 71.7 },
    { value: "Imphal East", count: 13, percent: 21.7 },
    { value: "Bishnupur", count: 3, percent: 5.0 },
    { value: "Thoubal", count: 1, percent: 1.7 },
  ];

  it("keeps every group at or above the audience's threshold exactly as-is", () => {
    const result = suppressSmallCells(entries, "public");
    expect(result).toContainEqual({ value: "Imphal West", count: 43, percent: 71.7 });
    expect(result).toContainEqual({ value: "Imphal East", count: 13, percent: 21.7 });
  });

  it("merges every group below the threshold into a single trailing 'Other (suppressed)' bucket, summing their counts", () => {
    const result = suppressSmallCells(entries, "public");
    const suppressed = result.find((e) => e.suppressed);
    expect(suppressed).toEqual({ value: "Other (suppressed)", count: 4, percent: 6.7, suppressed: true });
    expect(result.find((e) => e.value === "Thoubal")).toBeUndefined();
  });

  it("uses a more permissive threshold for an approved, accountable researcher than for the fully public page", () => {
    expect(MIN_CELL_SIZE.public).toBe(10);
    expect(MIN_CELL_SIZE.researcher).toBe(5);

    const forResearcher = suppressSmallCells(entries, "researcher");
    expect(forResearcher.find((e) => e.value === "Bishnupur")).toBeUndefined();
    const midSize: CategoricalBreakdown[] = [{ value: "Chandel", count: 7, percent: 100 }];
    expect(suppressSmallCells(midSize, "researcher")[0].suppressed).toBeUndefined();
    expect(suppressSmallCells(midSize, "public")[0].suppressed).toBe(true);
  });

  it("is a no-op when every group already clears the threshold", () => {
    const allLarge: CategoricalBreakdown[] = [
      { value: "Male", count: 40, percent: 58.3 },
      { value: "Female", count: 30, percent: 41.7 },
    ];
    expect(suppressSmallCells(allLarge, "public")).toEqual(allLarge);
  });

  it("does not treat a real zero count as something to suppress", () => {
    const withZero: CategoricalBreakdown[] = [{ value: "Twins", count: 0, percent: 0 }];
    expect(suppressSmallCells(withZero, "public")).toEqual(withZero);
  });
});

describe("suppressSmallCrossTabCells", () => {
  it("zeroes and flags a small cell instead of merging it", () => {
    const cells: CrossTabCell[] = [
      { filterValue: "Imphal West", value: "Cesarean", count: 12, percent: 60 },
      { filterValue: "Thoubal", value: "Cesarean", count: 1, percent: 100 },
    ];
    const result = suppressSmallCrossTabCells(cells, "public");
    expect(result[0]).toEqual(cells[0]);
    expect(result[1]).toEqual({ filterValue: "Thoubal", value: "Cesarean", count: 0, percent: 0, suppressed: true });
  });
});

describe("meetsMinimumSampleSize", () => {
  it("checks a whole result's sample size, not per-bucket", () => {
    expect(meetsMinimumSampleSize(3, "public")).toBe(false);
    expect(meetsMinimumSampleSize(10, "public")).toBe(true);
    expect(meetsMinimumSampleSize(9, "public")).toBe(false);
  });
});
