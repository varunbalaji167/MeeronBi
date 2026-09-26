// Fields computed at query time rather than stored directly — see docs/ANALYTICS_PLAN.md §4-§5.

import { computeGestationalAge } from "@/domain/gestationalAge";
import { TrimesterBucket } from "./types";

function completedYears(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && to.getDate() < from.getDate())) years--;
  return years;
}

/**
 * Age in completed years as of `(dateOfDelivery ?? edd ?? usgEdd)` — falling back through whichever
 * of those three dates is available, per ANALYTICS_PLAN §4. Null if `dob` is missing/unparseable,
 * or if none of the three reference dates are available/parseable, or the reference predates `dob`.
 */
export function computeAge(
  input: { dob: string | null | undefined; dateOfDelivery?: string | null; edd?: string | null; usgEdd?: string | null }
): number | null {
  if (!input.dob) return null;
  const dob = new Date(input.dob);
  if (Number.isNaN(dob.getTime())) return null;

  const referenceStr = input.dateOfDelivery ?? input.edd ?? input.usgEdd;
  if (!referenceStr) return null;
  const reference = new Date(referenceStr);
  if (Number.isNaN(reference.getTime()) || reference < dob) return null;

  return completedYears(dob, reference);
}

/**
 * BMI from height and first-visit weight. `weightFirstVisitKg` is used as a proxy for
 * pre-pregnancy weight — see the caveat in docs/ANALYTICS_PLAN.md §4; there is no dedicated
 * pre-pregnancy-weight field in the current dataset.
 */
export function computeBmi(heightCm: number | null | undefined, weightFirstVisitKg: number | null | undefined): number | null {
  if (!heightCm || !weightFirstVisitKg || heightCm <= 0 || weightFirstVisitKg <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightFirstVisitKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Which pregnancy-timeline bucket a dated entry (a TSH reading, a visit weight, ...) falls into,
 * relative to the patient's LMP. Reuses `computeGestationalAge` unchanged (ANALYTICS_PLAN §5).
 * Null if `lmp`/`entryDate` is missing/unparseable, or the entry is implausibly far past term.
 */
export function bucketTrimester(lmp: string | null | undefined, entryDate: string | Date): TrimesterBucket | null {
  if (!lmp) return null;
  const lmpDate = new Date(lmp);
  if (Number.isNaN(lmpDate.getTime())) return null;

  const entry = typeof entryDate === "string" ? new Date(entryDate) : entryDate;
  if (Number.isNaN(entry.getTime())) return null;

  if (entry.getTime() < lmpDate.getTime()) return "prePregnancy";

  const ga = computeGestationalAge(lmp, entry);
  if (!ga) return null;
  if (ga.weeks <= 13) return "t1";
  if (ga.weeks <= 27) return "t2";
  return "t3";
}
