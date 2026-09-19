import { TabConfig } from "./types";
import { educationLevels, incomeBrackets } from "./sharedOptions";
import { NAME_PATTERN, PLACE_NAME_PATTERN, RECORD_NUMBER_PATTERN, MANIPUR_DISTRICTS, COMMON_OCCUPATIONS, COMMON_RELIGIONS } from "../textPatterns";

export const personalTab: TabConfig = {
  key: "personal",
  label: "Personal",
  route: "personal",
  requiredFields: ["fullName", "dob", "lmp", "contactNo"],
  fieldValidators: {
    dob: (data) => {
      if (!data.dob) return null;
      return new Date(data.dob) > new Date() ? "Date of birth can't be in the future." : null;
    },
    lmp: (data) => {
      if (!data.lmp) return null;
      return new Date(data.lmp) > new Date() ? "LMP can't be in the future." : null;
    },
    edd: (data) => {
      if (!data.lmp || !data.edd) return null;
      return new Date(data.edd) <= new Date(data.lmp) ? "EDD should be after LMP." : null;
    },
  },
  sections: [
    {
      columns: 4,
      fields: [
        {
          name: "fullName",
          label: "1. Full Name",
          type: "text",
          placeholder: "e.g., Meikam Tombi Meitei",
          core: true,
          maxLength: 80,
          validation: { pattern: NAME_PATTERN, message: "Enter a name using letters, spaces, hyphens or apostrophes only." },
        },
        {
          name: "surname",
          label: "2. Surname",
          type: "text",
          placeholder: "Surname/Yumnak",
          maxLength: 60,
          validation: { pattern: NAME_PATTERN, message: "Enter a surname using letters, spaces, hyphens or apostrophes only." },
        },
        {
          name: "name",
          label: "3. Name",
          type: "text",
          placeholder: "Name/Ming",
          maxLength: 60,
          validation: { pattern: NAME_PATTERN, message: "Enter a name using letters, spaces, hyphens or apostrophes only." },
        },
        {
          name: "mrn",
          label: "4. CR No./MRD",
          type: "text",
          placeholder: "Enter CR No./MRD",
          core: true,
          maxLength: 20,
          validation: {
            pattern: RECORD_NUMBER_PATTERN,
            message: "MRD should be 3-20 characters — letters, numbers, hyphens, or slashes only, starting with a letter or number.",
          },
        },

        // Stored as { countryIso, number } — see domain/phone.ts. Works for
        // any country's numbering plan rather than assuming one.
        { name: "contactNo", label: "5. Contact No.", type: "phone", icon: "phone", core: true },
        { name: "dob", label: "6. Date of Birth", type: "date", helpText: "Must be in the past.", core: true },
        { name: "lmp", label: "7. LMP", type: "date", core: true },
        // The source spec shows this greyed-out/auto-suggested with no red
        // dot (unlike USG EDD below, which does have one) — it's a derived
        // convenience field, not one of the tab's shown-by-default fields.
        { name: "edd", label: "8. EDD", type: "date", helpText: "Auto-suggested as LMP + 280 days; editable." },

        { name: "usgEdd", label: "9. USG EDD", type: "date", core: true },
        { name: "heightCm", label: "10. Height (in Cm)", type: "number", placeholder: "e.g., 160", validation: { min: 120, max: 210, message: "Height should be between 120-210 cm." } },
        { name: "weightFirstVisitKg", label: "11. Wt. in First Visit (in Kg)", type: "number", placeholder: "e.g., 52", validation: { min: 30, max: 150, message: "Weight should be between 30-150 kg." }, core: true },
        { name: "weightLastVisitKg", label: "12. Wt. in Last Visit (in Kg)", type: "number", placeholder: "e.g., 60", validation: { min: 30, max: 150, message: "Weight should be between 30-150 kg." }, core: true },

        // Religion/Profession/Spouse's Occupation: converted from free text
        // to a closed list + "Other" (see docs/INPUT_HARDENING_PLAN.md).
        // These feed the Analytics module's categorical breakdowns
        // (domain/analytics/types.ts) directly — free text here means
        // "Teacher"/"teacher"/"TEACHER" silently fragment into three
        // buckets on a chart. `allowOther: true` keeps a genuine outlier
        // recordable without forcing every value into the curated list.
        { name: "religion", label: "13. Religion", type: "select", options: COMMON_RELIGIONS, allowOther: true, core: true },
        { name: "profession", label: "14. Profession", type: "select", options: COMMON_OCCUPATIONS, allowOther: true, core: true },
        { name: "highestEducation", label: "15. Highest Education", type: "select", options: educationLevels, core: true },
        { name: "income", label: "16. Income", type: "select", options: incomeBrackets },

        {
          name: "spouseName",
          label: "17. Spouse's Name",
          type: "text",
          placeholder: "Father of the baby",
          core: true,
          maxLength: 80,
          validation: { pattern: NAME_PATTERN, message: "Enter a name using letters, spaces, hyphens or apostrophes only." },
        },
        { name: "spouseEducation", label: "18. Highest Education", type: "select", options: educationLevels },
        { name: "spouseOccupation", label: "19. Occupation", type: "select", options: COMMON_OCCUPATIONS, allowOther: true, placeholder: "e.g., Teacher" },
        { name: "spouseIncome", label: "20. Spouse's Income", type: "select", options: incomeBrackets },

        // Address/Landmark stay genuinely free text — house numbers,
        // commas, slashes and every other punctuation mark are legitimate
        // here, so a character-class pattern would do more harm than good.
        // Length-capped and control-character-stripped server-side
        // regardless (see domain/validation.ts's sanitizeTabData).
        { name: "address", label: "21. Address", type: "text", placeholder: "e.g., Kongba Laishram Leikai", core: true, maxLength: 200 },
        { name: "landmark", label: "21a. Nearest Landmark", type: "text", placeholder: "e.g., Kongba Bridge", maxLength: 100 },
        // City/Town: unlike District below, there's no small authoritative
        // list of every settlement in a hospital's catchment area to
        // hardcode responsibly — stays free text, but pattern-restricted to
        // what a place name can actually contain (see
        // docs/INPUT_HARDENING_PLAN.md for why this differs from District).
        {
          name: "cityTown",
          label: "22. City/Town",
          type: "text",
          placeholder: "e.g., Kongba",
          core: true,
          maxLength: 60,
          validation: { pattern: PLACE_NAME_PATTERN, message: "Enter a place name using letters, numbers, spaces or hyphens only." },
        },
        // District: Manipur's 16 districts are a small, stable, officially
        // defined set (verified Dec-2016 list, not assumed from memory —
        // see domain/textPatterns.ts) — this is the field the Analytics
        // module's own example chart ("Patient Count by District") depends
        // on being clean categorical data, so it becomes a real dropdown.
        { name: "district", label: "23. District", type: "select", options: MANIPUR_DISTRICTS, allowOther: true, core: true },
        // Postal codes vary hugely by country (digits-only in some, alphanumeric
        // in others like Canada/UK) — kept as free text with a length cap
        // rather than a country-specific pattern, so this works globally.
        { name: "pin", label: "24. Postal / PIN Code", type: "text", placeholder: "e.g., 795005 or SW1A 1AA", icon: "location", maxLength: 12, core: true },
      ],
    },
  ],
};
