// Statistical disclosure control (small-cell suppression) for Analytics results.
// Shapes results by audience tier; does not decide who may see what (see server/auth/guards.ts).

import { CategoricalBreakdown, CrossTabCell } from "./types";

/** Disclosure context for a result: own-facility view, researcher, or public. */
export type DisclosureAudience = "internal" | "researcher" | "public";

/** k-anonymity thresholds: groups smaller than this are merged/suppressed rather than shown as-is. */
export const MIN_CELL_SIZE: Record<DisclosureAudience, number> = {
  internal: 5,
  researcher: 5,
  public: 10,
};

const SUPPRESSED_LABEL = "Other (suppressed)";

/** Merges entries below the threshold into a trailing "Other (suppressed)" bucket. */
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
      ? { ...cell, count: 0, percent: 0, suppressed: true } // can't merge a cross-tab cell into a neighbor, so zero and flag it
      : cell
  );
}

/** Whether a whole result (e.g. a scatter plot) has enough patients to be safe to return at this audience level. */
export function meetsMinimumSampleSize(totalCount: number, audience: DisclosureAudience): boolean {
  return totalCount >= MIN_CELL_SIZE[audience];
}
