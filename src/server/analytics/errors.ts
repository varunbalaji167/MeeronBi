// ─────────────────────────────────────────────────────────────────────────
// Namespaced `detail` codes for Analytics-specific failures — see
// server/http/errors.ts's module comment for the `code` vs `detail`
// convention this follows. Defined here, not in the shared errors.ts,
// because each domain owns its own detail-code vocabulary rather than
// everything piling into one giant enum. This file has no aggregation
// logic in it (that doesn't exist yet — see docs/ANALYTICS_PLAN.md) — it's
// just the error vocabulary, ready for whenever field-resolution/
// aggregation code gets written against it.
//
// Every one of these maps to a REQUEST-shape problem (something wrong with
// what was asked for) — not a property of the result. "Not enough data to
// chart" and "this bucket got suppressed" are NOT errors: they're normal,
// expected outcomes with their own place in the result's shape (see
// domain/analytics/disclosureControl.ts's meetsMinimumSampleSize, and the
// `suppressed` flag on CategoricalBreakdown/CrossTabCell in
// domain/analytics/types.ts). Throwing for those would make a completely
// ordinary "this cohort is too small yet" outcome look like a bug.
// ─────────────────────────────────────────────────────────────────────────

import { ValidationError } from "@/server/http/errors";

export const ANALYTICS_ERROR = {
  UNKNOWN_FIELD: "ANALYTICS.UNKNOWN_FIELD",
  UNKNOWN_FILTER: "ANALYTICS.UNKNOWN_FILTER",
  SAME_FIELD_AS_FILTER: "ANALYTICS.SAME_FIELD_AS_FILTER",
  FIELD_NOT_ANALYZABLE: "ANALYTICS.FIELD_NOT_ANALYZABLE",
} as const;

export function unknownFieldError(ref: string): ValidationError {
  return new ValidationError(`"${ref}" isn't a recognized analytics field.`, undefined, ANALYTICS_ERROR.UNKNOWN_FIELD);
}

export function unknownFilterError(ref: string): ValidationError {
  return new ValidationError(`"${ref}" isn't a recognized filter field.`, undefined, ANALYTICS_ERROR.UNKNOWN_FILTER);
}

export function sameFieldAsFilterError(): ValidationError {
  return new ValidationError(
    "The filter field can't be the same as the field being analyzed.",
    undefined,
    ANALYTICS_ERROR.SAME_FIELD_AS_FILTER
  );
}

/** e.g. someone tries to analyze a `text`/`textarea` field, which domain/analytics's field registry never lists as analyzable in the first place — this is the defense-in-depth check for a hand-built request, not something the picker UI should ever be able to trigger. */
export function fieldNotAnalyzableError(ref: string): ValidationError {
  return new ValidationError(
    `"${ref}" can't be used for analytics (it's free text, or excluded from the field picker).`,
    undefined,
    ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE
  );
}
