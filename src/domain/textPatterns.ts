// Shared regex patterns and option lists for tightening what text fields accept.

/** A person's name in any script: Unicode letters/marks, spaces, hyphens, apostrophes, periods. No length limit; pair with `maxLength`. */
export const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

/** A place name: same as NAME_PATTERN but also allows digits and commas. */
export const PLACE_NAME_PATTERN = /^[\p{L}\p{M}0-9 ,.'-]+$/u;

/** CR No./MRD: alphanumeric plus hyphen/slash, 3-20 chars (no universal record-number standard exists). */
export const RECORD_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{2,19}$/;

/** Manipur's 16 districts post the December 2016 reorganization. Alphabetical; paired with `allowOther: true`. */
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

/** Curated, non-exhaustive occupation list (paired with `allowOther: true`) to keep common values consistent. */
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

/** A well-known but non-exhaustive list, paired with `allowOther: true`. */
export const COMMON_RELIGIONS = [
  "Hinduism",
  "Christianity",
  "Islam",
  "Sanamahi",
  "Buddhism",
  "No religion",
];
