// Summary statistics for a Ratio field's values — see docs/ANALYTICS_PLAN.md §2's "Central
// tendencies" cell. Callers are responsible for filtering to non-null/finite values first
// (resolveValue.ts's resolvers already return null for anything that can't be included).

import { CentralTendencies } from "./types";

/** Smallest value with the highest frequency, or `null` when every distinct value is equally frequent (no value stands out). */
function computeMode(values: number[]): number | null {
  const frequency = new Map<number, number>();
  for (const v of values) frequency.set(v, (frequency.get(v) ?? 0) + 1);

  const distinct = [...frequency.keys()];
  if (distinct.length <= 1) return distinct[0] ?? null;

  const maxFrequency = Math.max(...frequency.values());
  const allEquallyFrequent = distinct.every((v) => frequency.get(v) === maxFrequency);
  if (allEquallyFrequent) return null;

  const mostFrequent = distinct.filter((v) => frequency.get(v) === maxFrequency);
  return Math.min(...mostFrequent);
}

/** count/average/max/min/mode/population-standard-deviation over `values`. Empty input returns all-zero/null rather than NaN. */
export function centralTendencies(values: number[]): CentralTendencies {
  const count = values.length;
  if (count === 0) {
    return { count: 0, average: 0, max: 0, min: 0, mode: null, standardDeviation: 0 };
  }

  const sum = values.reduce((acc, v) => acc + v, 0);
  const average = sum / count;
  const variance = values.reduce((acc, v) => acc + (v - average) ** 2, 0) / count;

  return {
    count,
    average,
    max: Math.max(...values),
    min: Math.min(...values),
    mode: computeMode(values),
    standardDeviation: Math.sqrt(variance),
  };
}
