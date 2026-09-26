// Namespaced `detail` codes for Analytics-specific request errors.
// Suppressed/low-sample results are not errors and aren't represented here.

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

/** Field isn't analyzable (e.g. free text) — defense-in-depth for a hand-built request. */
export function fieldNotAnalyzableError(ref: string): ValidationError {
  return new ValidationError(
    `"${ref}" can't be used for analytics (it's free text, or excluded from the field picker).`,
    undefined,
    ANALYTICS_ERROR.FIELD_NOT_ANALYZABLE
  );
}
