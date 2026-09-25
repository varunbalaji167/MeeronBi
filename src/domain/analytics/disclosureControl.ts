// ─────────────────────────────────────────────────────────────────────────
// Statistical disclosure control for Analytics results. Built FIRST, before
// any aggregation function exists, specifically so every one of them is
// written against this from day one — retrofitting suppression after N
// aggregation functions already exist means re-auditing all N of them, not
// just adding a new module. See docs/ANALYTICS_PLAN.md §7 and
// docs/SCALING_PLAN.md's trends-page section for the disclosure risks this
// exists to close (small-cell re-identification, the "Thoubal: n=1"
// problem — a real example already present in the source spec's own
// sample data).
//
// This module NEVER decides who is allowed to see what — that's
// server/auth/guards.ts's job. It only decides, given an audience tier,
// how a result must be shaped before it leaves the server. Every
// aggregation function in server/analytics/ (once written) must route its
// output through here before returning it — no aggregation function
// decides suppression on its own.
// ─────────────────────────────────────────────────────────────────────────

import { CategoricalBreakdown, CrossTabCell } from "./types";

/**
 * Which audience a result is being shaped for. Deliberately not a role
 * name (`ADMIN`/`RESEARCHER`/...) — a facility admin viewing their own
 * facility's data and a researcher viewing de-identified cross-facility
 * data are different DISCLOSURE contexts even though the role hierarchy
 * itself is a separate decision (see docs/SCALING_PLAN.md's RBAC section).
 * `internal` = viewing your own facility's own data, where re-identifying
 * "which of MY patients" isn't a privacy breach the way it is for anyone
 * external — suppression still applies (staff shouldn't casually see "the
 * one HIV-positive patient in District X" splashed across a chart either),
 * just at a more permissive threshold than a public or researcher view.
 */
export type DisclosureAudience = "internal" | "researcher" | "public";

/**
 * k-anonymity thresholds: any group smaller than this gets merged away
 * rather than shown with its true (re-identifying) count. Numbers, not
 * just the concept, need to be picked deliberately — these follow the
 * common public-health-statistics convention of k=5 for identified/
 * accountable access and k=10 for anything more exposed; `internal` sits
 * between "no protection at all" and the public threshold since it's
 * still worth protecting a specific patient from being singled out on a
 * staff-facing chart, just not as strictly as external-facing views.
 */
export const MIN_CELL_SIZE: Record<DisclosureAudience, number> = {
  internal: 5,
  researcher: 5,
  public: 10,
};

const SUPPRESSED_LABEL = "Other (suppressed)";

/**
 * Merges every entry below the threshold into a single trailing
 * "Other (suppressed)" bucket instead of returning their true small
 * counts. Order-preserving for the kept entries; the suppressed bucket (if
 * any) is always last. A no-op if nothing needs suppressing — callers
 * should still always call this rather than skip it "because the data's
 * probably fine", since that judgment call is exactly what this function
 * exists to take out of each call site's hands.
 */
export function suppressSmallCells<T extends CategoricalBreakdown>(entries: T[], audience: DisclosureAudience): T[] {
  const minCellSize = MIN_CELL_SIZE[audience];
  const kept: T[] = [];
  let suppressedCount = 0;
  let suppressedPercent = 0;

  for (const entry of entries) {
    if (entry.count > 0 && entry.count < minCellSize) {
      suppressedCount += entry.count;
      suppressedPercent += entry.percent;
    } else {
      kept.push(entry);
    }
  }

  if (suppressedCount > 0) {
    kept.push({ ...entries[0], value: SUPPRESSED_LABEL, count: suppressedCount, percent: suppressedPercent, suppressed: true } as T);
  }
  return kept;
}

/** Same idea as suppressSmallCells, for a Categorical x Categorical cross-tab's cells. */
export function suppressSmallCrossTabCells(cells: CrossTabCell[], audience: DisclosureAudience): CrossTabCell[] {
  const minCellSize = MIN_CELL_SIZE[audience];
  return cells.map((cell) =>
    cell.count > 0 && cell.count < minCellSize
      ? { ...cell, count: 0, percent: 0, suppressed: true } // a cross-tab cell can't be "merged" into a neighbor the way a flat breakdown can — zero it and flag it instead
      : cell
  );
}

/**
 * Whether an entire result is even safe to return at this audience level,
 * independent of any per-bucket suppression above. A scatter plot (or any
 * chart where each point/row IS one patient) of 3 dots is 3 identifiable
 * dots no matter how the axes are chosen or how the buckets are drawn —
 * suppressing individual "cells" doesn't help when the whole result only
 * has a handful of patients in it. Callers (scatter plots especially, but
 * also a ratio summary with a very small cohort) must check this BEFORE
 * returning anything, and report "not enough data to show at this
 * audience level" rather than a tiny, technically-unsuppressed result.
 */
export function meetsMinimumSampleSize(totalCount: number, audience: DisclosureAudience): boolean {
  return totalCount >= MIN_CELL_SIZE[audience];
}
