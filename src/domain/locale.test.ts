import { describe, it, expect } from "vitest";
import { formatDate, parseDate, formatMeasurement } from "./locale";

describe("formatDate", () => {
  const d = new Date(2026, 2, 5); // 5 March 2026

  it("renders day-before-month for en-IN, the current default", () => {
    expect(formatDate(d, "en-IN")).toBe("05-03-2026");
  });

  it("renders month-before-day for en-US, proving the abstraction actually switches order", () => {
    expect(formatDate(d, "en-US")).toBe("03-05-2026");
  });
});

describe("parseDate", () => {
  it("parses dd-mm-yyyy under en-IN", () => {
    const parsed = parseDate("05-03-2026", "en-IN");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(5);
  });

  it("parses the same digits differently under en-US (mm-dd-yyyy)", () => {
    const parsed = parseDate("05-03-2026", "en-US");
    expect(parsed?.getMonth()).toBe(4); // month 05 -> May
    expect(parsed?.getDate()).toBe(3);
  });

  it("returns null for an unparseable string instead of throwing", () => {
    expect(parseDate("not a date", "en-IN")).toBeNull();
  });

  it("returns null for a date that doesn't exist (e.g. 31st of a 30-day month) rather than silently rolling over", () => {
    expect(parseDate("31-02-2026", "en-IN")).toBeNull();
  });
});

describe("formatMeasurement", () => {
  it("passes a stored cm value through unchanged for en-IN (metric default)", () => {
    expect(formatMeasurement(160, "cm", "en-IN")).toBe("160 cm");
  });

  it("converts a stored cm value to inches for en-US", () => {
    expect(formatMeasurement(160, "cm", "en-US")).toBe("63 in");
  });

  it("passes a stored kg value through unchanged for en-IN", () => {
    expect(formatMeasurement(60, "kg", "en-IN")).toBe("60 kg");
  });

  it("converts a stored kg value to pounds for en-US", () => {
    expect(formatMeasurement(60, "kg", "en-US")).toBe("132.3 lb");
  });
});
