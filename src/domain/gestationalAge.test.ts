import { describe, it, expect } from "vitest";
import { computeGestationalAge, formatGestationalAge, isWithinWindow, weeksWindow } from "./gestationalAge";

const DAY_MS = 86_400_000;

/**
 * Adds whole days using raw millisecond math rather than Date's
 * getDate()/setDate() (which operate in the machine's LOCAL timezone and
 * can silently land on the wrong calendar day near a DST/timezone
 * boundary). computeGestationalAge itself does the same millisecond-based
 * subtraction internally, so this keeps the test's arithmetic exactly
 * aligned with what's actually being tested — see the function's own
 * `Math.floor((asOf.getTime() - lmpDate.getTime()) / 86_400_000)`.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

describe("computeGestationalAge", () => {
  const lmp = "2024-01-01";

  it("returns null for a missing or unparseable LMP", () => {
    expect(computeGestationalAge(null)).toBeNull();
    expect(computeGestationalAge(undefined)).toBeNull();
    expect(computeGestationalAge("not-a-date")).toBeNull();
  });

  it("splits total days since LMP into completed weeks + remainder days", () => {
    const asOf = addDays(new Date(lmp), 87); // 12 weeks, 3 days
    expect(computeGestationalAge(lmp, asOf)).toEqual({ weeks: 12, days: 3, totalDays: 87 });
  });

  it("is exactly zero on the LMP date itself", () => {
    expect(computeGestationalAge(lmp, new Date(lmp))).toEqual({ weeks: 0, days: 0, totalDays: 0 });
  });

  it("returns null for an LMP in the future relative to `asOf` — a negative age isn't a real pregnancy", () => {
    const asOf = addDays(new Date(lmp), -1);
    expect(computeGestationalAge(lmp, asOf)).toBeNull();
  });

  it("returns null past ~45 weeks — safer to show nothing than a nonsense 'week 60' badge", () => {
    const stillPlausible = addDays(new Date(lmp), 45 * 7);
    const implausible = addDays(new Date(lmp), 45 * 7 + 1);
    expect(computeGestationalAge(lmp, stillPlausible)).not.toBeNull();
    expect(computeGestationalAge(lmp, implausible)).toBeNull();
  });
});

describe("formatGestationalAge", () => {
  it("renders as '<weeks>w<days>d', and an em dash for no data", () => {
    expect(formatGestationalAge({ weeks: 12, days: 3, totalDays: 87 })).toBe("12w3d");
    expect(formatGestationalAge(null)).toBe("—");
  });
});

describe("weeksWindow", () => {
  it("converts a weeks+days range into the totalDays range isWithinWindow compares against", () => {
    // The NT scan's real recommended window, per domain/tabs/ultrasound.ts.
    expect(weeksWindow(11, 0, 13, 6, "11w0d – 13w6d")).toEqual({ minDays: 77, maxDays: 97, label: "11w0d – 13w6d" });
  });
});

describe("isWithinWindow", () => {
  const ntWindow = weeksWindow(11, 0, 13, 6, "NT scan window");

  it("is false with no gestational age to compare (e.g. LMP not on file yet)", () => {
    expect(isWithinWindow(null, ntWindow)).toBe(false);
  });

  it("checks a single window's inclusive bounds", () => {
    const justInside = computeGestationalAge("2024-01-01", addDays(new Date("2024-01-01"), 77));
    const justOutside = computeGestationalAge("2024-01-01", addDays(new Date("2024-01-01"), 76));
    expect(isWithinWindow(justInside, ntWindow)).toBe(true);
    expect(isWithinWindow(justOutside, ntWindow)).toBe(false);
  });

  it("with an array of windows, is true if ANY of them match — e.g. the Uterine Artery Doppler's two separate recommended windows", () => {
    const dopplerWindows = [weeksWindow(11, 0, 14, 0, "first window"), weeksWindow(20, 0, 24, 0, "second window")];
    const inFirstWindow = computeGestationalAge("2024-01-01", addDays(new Date("2024-01-01"), 12 * 7));
    const inTheGapBetween = computeGestationalAge("2024-01-01", addDays(new Date("2024-01-01"), 17 * 7));
    const inSecondWindow = computeGestationalAge("2024-01-01", addDays(new Date("2024-01-01"), 22 * 7));

    expect(isWithinWindow(inFirstWindow, dopplerWindows)).toBe(true);
    expect(isWithinWindow(inTheGapBetween, dopplerWindows)).toBe(false);
    expect(isWithinWindow(inSecondWindow, dopplerWindows)).toBe(true);
  });
});
