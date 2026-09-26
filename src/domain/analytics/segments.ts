// Buckets a Ratio field's values into brackets — a Standard Segment when one is defined for the
// field, else a generated equal-width histogram. See docs/ANALYTICS_PLAN.md §2 and §6.

import { AnalyticsFieldMeta, SegmentBracket, SegmentedBreakdown, STANDARD_SEGMENTS } from "./types";

function formatNum(n: number): string {
  return n.toFixed(1);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Equal-width bins spanning [min(values), max(values)]. Empty input → no bins; all-equal input → one bin. */
export function generateHistogramBrackets(values: number[], binCount = 8): SegmentBracket[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: formatNum(min), min, max }];
  }

  const width = (max - min) / binCount;
  const brackets: SegmentBracket[] = [];
  for (let i = 0; i < binCount; i++) {
    const binMin = min + i * width;
    // Last bin's upper edge is exactly `max`, not `min + binCount * width`, to avoid float drift excluding it.
    const binMax = i === binCount - 1 ? max : min + (i + 1) * width;
    brackets.push({ label: `${formatNum(binMin)}–${formatNum(binMax)}`, min: binMin, max: binMax });
  }
  return brackets;
}

// `STANDARD_SEGMENTS.tsh` is keyed by trimester, not a flat array, so it's excluded here — it
// belongs to time-series mode only. Falls back to a generated histogram if no segment applies.
export function bracketsForField(meta: AnalyticsFieldMeta, values: number[]): SegmentBracket[] {
  const key = meta.standardSegmentKey;
  if (key) {
    const segment = STANDARD_SEGMENTS[key];
    if (Array.isArray(segment)) return segment;
  }
  return generateHistogramBrackets(values);
}

/** Index of the bracket whose inclusive [min,max] contains `value` (open ends = unbounded that side); -1 if none match. */
export function assignBracket(value: number, brackets: SegmentBracket[]): number {
  return brackets.findIndex(
    (bracket) => (bracket.min === undefined || value >= bracket.min) && (bracket.max === undefined || value <= bracket.max)
  );
}

/** Count + percent-of-`values.length` per bracket. Values matching no bracket are excluded from every count but still counted in the percent denominator, so coverage gaps show up rather than being hidden by renormalizing. */
export function segmentedBreakdown(values: number[], brackets: SegmentBracket[]): SegmentedBreakdown[] {
  const counts = new Array(brackets.length).fill(0);
  for (const value of values) {
    const index = assignBracket(value, brackets);
    if (index !== -1) counts[index]++;
  }

  const total = values.length;
  return brackets.map((bracket, i) => ({
    value: bracket.label,
    bracket,
    count: counts[i],
    percent: total === 0 ? 0 : round1((counts[i] / total) * 100),
  }));
}
