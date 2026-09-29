// The six cohort-mode branches (docs/ANALYTICS.md §2), split out of aggregate.ts's dispatch
// so the privacy-critical suppression logic in each branch is reviewable on its own.

import { ok, Result } from "@/domain/result";
import {
  AnalyticsFieldMeta,
  AnalyticsResult,
  CategoricalBreakdown,
  CohortDataset,
  CrossTabCell,
  ScatterPoint,
} from "@/domain/analytics/types";
import { DisclosureAudience, meetsMinimumSampleSize, suppressSmallCells, suppressSmallCrossTabCells } from "@/domain/analytics/disclosureControl";
import { resolveCategoricalValue, resolveRatioValue } from "@/domain/analytics/resolveValue";
import { centralTendencies } from "@/domain/analytics/statistics";
import { assignBracket, bracketsForField, segmentedBreakdown } from "@/domain/analytics/segments";
import { ValidationError } from "@/server/http/errors";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Ratio field, no filter: central tendencies + bucketed histogram/Standard-Segment breakdown.
// Below-threshold shape decision: see docs/ANALYTICS.md §"Disclosure-control shape decisions".
export function ratioNoFilter(field: AnalyticsFieldMeta, dataset: CohortDataset, audience: DisclosureAudience): Result<AnalyticsResult, ValidationError> {
  const values = dataset
    .map((patient) => resolveRatioValue(field.ref, patient.tabs))
    .filter((v): v is number => v !== null);

  if (!meetsMinimumSampleSize(values.length, audience)) {
    return ok({ kind: "ratioSummary", stats: centralTendencies([]), buckets: [] });
  }

  const stats = centralTendencies(values);
  const brackets = bracketsForField(field, values);
  const buckets = suppressSmallCells(segmentedBreakdown(values, brackets), audience);
  return ok({ kind: "ratioSummary", stats, buckets });
}

// Ratio field, Ratio filter: scatter plot — see docs/ANALYTICS.md's disclosure-control notes.
export function ratioByRatio(
  field: AnalyticsFieldMeta,
  filter: AnalyticsFieldMeta,
  dataset: CohortDataset,
  audience: DisclosureAudience
): Result<AnalyticsResult, ValidationError> {
  const points: ScatterPoint[] = [];
  for (const patient of dataset) {
    const x = resolveRatioValue(field.ref, patient.tabs);
    const y = resolveRatioValue(filter.ref, patient.tabs);
    if (x !== null && y !== null) points.push({ x, y });
  }

  if (!meetsMinimumSampleSize(points.length, audience)) {
    return ok({ kind: "ratioScatter", points: [] });
  }
  return ok({ kind: "ratioScatter", points });
}

// Ratio field, Categorical filter: per-category central tendencies, groups below threshold dropped.
export function ratioByCategory(
  field: AnalyticsFieldMeta,
  filter: AnalyticsFieldMeta,
  dataset: CohortDataset,
  audience: DisclosureAudience
): Result<AnalyticsResult, ValidationError> {
  const valuesByGroup = new Map<string, number[]>();
  for (const patient of dataset) {
    const groupValue = resolveCategoricalValue(filter.ref, patient.tabs);
    if (groupValue === null) continue;
    const value = resolveRatioValue(field.ref, patient.tabs);
    if (value === null) continue;
    const values = valuesByGroup.get(groupValue) ?? [];
    values.push(value);
    valuesByGroup.set(groupValue, values);
  }

  const groups = [...valuesByGroup.entries()]
    .map(([value, values]) => ({ value, stats: centralTendencies(values) }))
    .filter((group) => meetsMinimumSampleSize(group.stats.count, audience));

  return ok({ kind: "ratioByCategory", groups });
}

/** Categorical field, no filter: count + percent per distinct value. */
export function categoryNoFilter(field: AnalyticsFieldMeta, dataset: CohortDataset, audience: DisclosureAudience): Result<AnalyticsResult, ValidationError> {
  const values = dataset
    .map((patient) => resolveCategoricalValue(field.ref, patient.tabs))
    .filter((v): v is string => v !== null);

  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  const total = values.length;
  const breakdown: CategoricalBreakdown[] = [...counts.entries()].map(([value, count]) => ({
    value,
    count,
    percent: total === 0 ? 0 : round1((count / total) * 100),
  }));

  return ok({ kind: "categorySummary", breakdown: suppressSmallCells(breakdown, audience) });
}

// Counts patients per (filterValue, fieldValue) pair; percent is of the filterValue group's own
// total. Shared by `categoryByCategory`/`categoryByRatio` so the two branches stay consistent.
function crossTab(pairs: { filterValue: string; value: string }[], audience: DisclosureAudience): CrossTabCell[] {
  const groupTotals = new Map<string, number>();
  const cellCounts = new Map<string, number>();
  for (const { filterValue, value } of pairs) {
    groupTotals.set(filterValue, (groupTotals.get(filterValue) ?? 0) + 1);
    const key = `${filterValue}\u0000${value}`;
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  const cells: CrossTabCell[] = [];
  for (const [key, count] of cellCounts) {
    const [filterValue, value] = key.split("\u0000");
    const groupTotal = groupTotals.get(filterValue)!;
    cells.push({ filterValue, value, count, percent: round1((count / groupTotal) * 100) });
  }

  return suppressSmallCrossTabCells(cells, audience);
}

/** Categorical field, Categorical filter: cross-tab of counts. */
export function categoryByCategory(
  field: AnalyticsFieldMeta,
  filter: AnalyticsFieldMeta,
  dataset: CohortDataset,
  audience: DisclosureAudience
): Result<AnalyticsResult, ValidationError> {
  const pairs: { filterValue: string; value: string }[] = [];
  for (const patient of dataset) {
    const filterValue = resolveCategoricalValue(filter.ref, patient.tabs);
    const value = resolveCategoricalValue(field.ref, patient.tabs);
    if (filterValue !== null && value !== null) pairs.push({ filterValue, value });
  }

  return ok({ kind: "categoryByCategory", cells: crossTab(pairs, audience) });
}

/** Categorical field, Ratio filter: bucket the ratio filter into a Standard Segment/histogram first, then treat as Categorical x Categorical. */
export function categoryByRatio(
  field: AnalyticsFieldMeta,
  filter: AnalyticsFieldMeta,
  dataset: CohortDataset,
  audience: DisclosureAudience
): Result<AnalyticsResult, ValidationError> {
  const filterValues = dataset.map((patient) => resolveRatioValue(filter.ref, patient.tabs));
  const brackets = bracketsForField(
    filter,
    filterValues.filter((v): v is number => v !== null)
  );

  const pairs: { filterValue: string; value: string }[] = [];
  dataset.forEach((patient, i) => {
    const filterValue = filterValues[i];
    if (filterValue === null) return;
    const bracketIndex = assignBracket(filterValue, brackets);
    if (bracketIndex === -1) return;

    const value = resolveCategoricalValue(field.ref, patient.tabs);
    if (value === null) return;
    pairs.push({ filterValue: brackets[bracketIndex].label, value });
  });

  return ok({ kind: "categoryByCategory", cells: crossTab(pairs, audience) });
}
