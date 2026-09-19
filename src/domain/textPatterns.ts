// ─────────────────────────────────────────────────────────────────────────
// Shared, reusable pieces for tightening what a text field will actually
// accept — pulled out here instead of inlined per-field so the same rule
// (and the same reasoning for it) isn't copy-pasted and silently drifting
// across personal.ts/history.ts/etc. See docs/INPUT_HARDENING_PLAN.md for
// the full field-by-field audit this file supports.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A person's name, in any script: Unicode letters/marks (so this doesn't
 * reject non-Latin names), spaces, hyphens, apostrophes, and periods
 * (initials). Deliberately does NOT restrict length here — pair with
 * `maxLength` per field.
 */
export const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

/**
 * A place name (city/town, landmark) — same idea as NAME_PATTERN but also
 * allows digits (e.g. "Sector 5", "New Delhi-110001" written informally)
 * and commas.
 */
export const PLACE_NAME_PATTERN = /^[\p{L}\p{M}0-9 ,.'-]+$/u;

/**
 * CR No./MRD: a hospital-assigned record number. No universal standard
 * exists for these (confirmed by research — HL7/USCDI just calls it "an
 * alphanumeric value unique within an organization"), so this stays
 * deliberately permissive: alphanumeric plus hyphen/slash, 3-20 chars.
 */
export const RECORD_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{2,19}$/;

/**
 * Manipur's 16 districts post the December 2016 reorganization (verified
 * against Wikipedia's List of districts of Manipur, not assumed from
 * memory — the state had 9 before that date, so this list is
 * time-sensitive). Alphabetical. Used with `allowOther: true` so a
 * genuine edge case (a patient from outside the state, or a future
 * re-districting) still has a way to be recorded rather than being
 * blocked outright.
 */
export const MANIPUR_DISTRICTS = [
  "Bishnupur",
  "Chandel",
  "Churachandpur",
  "Imphal East",
  "Imphal West",
  "Jiribam",
  "Kakching",
  "Kamjong",
  "Kangpokpi",
  "Noney",
  "Pherzawl",
  "Senapati",
  "Tamenglong",
  "Tengnoupal",
  "Thoubal",
  "Ukhrul",
];

/**
 * A curated, non-exhaustive list of common occupations, offered with
 * `allowOther: true`. The goal isn't to enumerate every possible job —
 * it's to make the common cases consistent (so "Teacher", "teacher", and
 * "TEACHER" don't fragment an analytics breakdown into three buckets)
 * while never blocking a genuine outlier.
 */
export const COMMON_OCCUPATIONS = [
  "Homemaker",
  "Farmer / Agriculture",
  "Teacher",
  "Nurse",
  "Doctor",
  "Government employee",
  "Police / Armed forces",
  "Business / Self-employed",
  "Private sector employee",
  "Labourer / Daily wage",
  "Student",
  "Unemployed",
];

/**
 * A well-known, small, closed set — kept `allowOther: true` anyway since
 * "well-known" isn't the same as "exhaustive" (this is a starting list,
 * not a census).
 */
export const COMMON_RELIGIONS = [
  "Hinduism",
  "Christianity",
  "Islam",
  "Sanamahi",
  "Buddhism",
  "No religion",
];
