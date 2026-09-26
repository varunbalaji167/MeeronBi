import { describe, it, expect } from "vitest";
import { NAME_PATTERN, PLACE_NAME_PATTERN, RECORD_NUMBER_PATTERN, MANIPUR_DISTRICTS } from "./textPatterns";

describe("NAME_PATTERN", () => {
  it("accepts real names — including accented/non-Latin letters, hyphens, and apostrophes", () => {
    expect(NAME_PATTERN.test("Meikam Tombi Meitei")).toBe(true);
    expect(NAME_PATTERN.test("O'Brien-Smith")).toBe(true);
    expect(NAME_PATTERN.test("Ngũyễn")).toBe(true);
  });

  it("rejects digits or symbols that aren't a legitimate part of any name", () => {
    expect(NAME_PATTERN.test("John123")).toBe(false);
    expect(NAME_PATTERN.test("<script>")).toBe(false);
  });
});

describe("PLACE_NAME_PATTERN", () => {
  it("is more permissive than NAME_PATTERN — place names legitimately include digits and commas", () => {
    expect(PLACE_NAME_PATTERN.test("Sector 5, New Delhi")).toBe(true);
    expect(PLACE_NAME_PATTERN.test("<script>")).toBe(false);
  });
});

describe("RECORD_NUMBER_PATTERN (CR No./MRD)", () => {
  it("accepts a plausible hospital record number", () => {
    expect(RECORD_NUMBER_PATTERN.test("DEMO-0001")).toBe(true);
    expect(RECORD_NUMBER_PATTERN.test("MRD/2024/001")).toBe(true);
  });

  it("rejects something too short to be a real record number, or one starting with a separator", () => {
    expect(RECORD_NUMBER_PATTERN.test("AB")).toBe(false);
    expect(RECORD_NUMBER_PATTERN.test("-ABC123")).toBe(false);
  });
});

describe("MANIPUR_DISTRICTS", () => {
  it("has exactly the 16 districts from the December 2016 reorganization", () => {
    expect(MANIPUR_DISTRICTS).toHaveLength(16);
    expect(new Set(MANIPUR_DISTRICTS).size).toBe(16);
  });

  it("includes the four districts the source spec's own example chart names", () => {
    for (const district of ["Imphal East", "Imphal West", "Bishnupur", "Thoubal"]) {
      expect(MANIPUR_DISTRICTS).toContain(district);
    }
  });
});
