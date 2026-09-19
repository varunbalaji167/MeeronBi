import { GridSectionConfig, TabConfig } from "./types";
import { positiveNegative, yesNo } from "./sharedOptions";

// Per the source spec's page 3 ("Default indicators to be recorded with
// red dots – Investigations are mandatory"), virtually every field on this
// tab carries a red dot — unlike Personal/History where only a subset is
// default-shown, this entire tab is the default set. So every plain-section
// field below is `core: true`; the grid sections (Thyroid/Genetic Tests,
// Reactive Tests, ECHO Findings) are already always-shown regardless of
// `core`, per domain/fieldVisibility.ts's documented scope boundary. The
// net effect: this tab has nothing left to hide via "Customize fields" (see
// isCustomizable in domain/fieldVisibility.ts), so that control no longer
// appears for this tab — which matches "Investigations are mandatory".
export const investigationTab: TabConfig = {
  key: "investigation",
  label: "Investigation",
  route: "investigation",
  requiredFields: ["bloodGroup", "haemoglobin"],
  sections: [
    {
      columns: 4,
      fields: [
        { name: "bloodGroup", label: "42. Blood Group", type: "select", options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], core: true },
        { name: "indCoombsTest", label: "43. Ind. Coomb's Test", type: "select", options: ["Positive", "Negative", "Not done"], core: true },
        { name: "titre", label: "44. Titre", type: "select", options: ["N/A", "1:2", "1:4", "1:8", "1:16", "1:32", ">1:32"], core: true },
        { name: "haemoglobin", label: "48. Haemoglobin (g/dL)", type: "number", placeholder: "E.g., 11.4", validation: { min: 2, max: 20, message: "Haemoglobin should be between 2-20 g/dL." }, core: true },
      ],
    },
    {
      kind: "grid",
      title: "Thyroid and Genetic Tests",
      valueColumns: [
        { name: "level", label: "Level", type: "text" },
        { name: "testDate", label: "Test Date", type: "date" },
        { name: "gestAgeWeeks", label: "Gest. Age (Weeks)", type: "number" },
      ],
      rows: [
        { name: "tsh", label: "45. TSH (mU/L)" },
        { name: "doubleMarkerQuad", label: "46. Double marker Or QUAD screen" },
        { name: "niptOrAmnio", label: "47. NIPT Or Amniocentesis" },
      ],
    } as GridSectionConfig,
    {
      columns: 4,
      fields: [
        { name: "tlcThousands", label: "49. TLC (in Thousands)", type: "number", placeholder: "1-15, -10 if not done", core: true },
        {
          name: "plateletCount",
          label: "50. Platelet Count (lakh/µL)",
          type: "number",
          placeholder: "e.g., 2.5",
          // Was free text in the source mockup ("Platelet Count") with a
          // placeholder implying a numeric range (".257-2.88 lakh") — this
          // is a lab value, so it becomes a real number field, both for
          // input consistency and so it's Analytics-eligible as Ratio data
          // (see domain/analytics/types.ts §3's type-mapping rule).
          validation: { min: 0.1, max: 15, message: "Platelet count should be between 0.1-15 lakh/µL." },
          core: true,
        },
        { name: "pbsFindings", label: "51. PBS findings", type: "select", options: ["Normal", "Microcytic hypochromic", "Macrocytic", "Other"], core: true },
        { name: "bloodIndicesPcv", label: "52. PCV", type: "number", core: true },
        { name: "bloodIndicesMcv", label: "52. MCV", type: "number", core: true },
        { name: "bloodIndicesMch", label: "52. MCH", type: "number", core: true },
        { name: "bloodIndicesMchc", label: "52. MCHC", type: "number", core: true },

        { name: "tsbMgdl", label: "53. TSB (mg/dL)", type: "number", placeholder: "0.1-9", core: true },
        { name: "sgot", label: "54. SGOT", type: "number", core: true },
        { name: "sgpt", label: "54. SGPT", type: "number", core: true },
        { name: "alkalinePhosphatase", label: "54. Alkaline phosphatase", type: "number", core: true },

        { name: "tsp", label: "55. TSP", type: "number", core: true },
        { name: "alb", label: "55. ALB", type: "number", core: true },
        { name: "glo", label: "55. GLO", type: "number", core: true },
        { name: "urea", label: "56. Urea", type: "number", core: true },
        { name: "creatinine", label: "56. Creatinine", type: "number", core: true },

        { name: "naPlus", label: "57. Na+", type: "number", core: true },
        { name: "kPlus", label: "57. K+", type: "number", core: true },
        { name: "clPlus", label: "57. Cl+", type: "number", core: true },
        { name: "uricAcid", label: "58. Uric acid", type: "number", core: true },
        { name: "ldh", label: "59. LDH", type: "number", core: true },
        { name: "urineProtein24hr", label: "60. 24 hr urine protein (mg)", type: "number", placeholder: "146 mg", core: true },
      ],
    },
    {
      title: "Other Findings",
      fields: [{ name: "otherFindings", label: "61. Other Findings", type: "textarea", core: true }],
    },
    {
      kind: "grid",
      title: "Reactive Tests",
      rowLabelHeader: "Test",
      valueColumns: [{ name: "result", label: "Result", type: "radio", options: positiveNegative }],
      rows: [
        { name: "vdrl", label: "62. VDRL" },
        { name: "hcvAb", label: "63. HCV Ab" },
        { name: "hbsAg", label: "64. HbSAg" },
        { name: "hiv", label: "65. HIV" },
      ],
    } as GridSectionConfig,
    {
      columns: 4,
      title: "Sugar Test",
      fields: [
        { name: "sugarTestDate", label: "Sugar Test Done on", type: "date", core: true },
        {
          name: "randomBloodSugar",
          label: "66. Random B Sugar (mg/dL)",
          type: "number",
          placeholder: "e.g., 110",
          validation: { min: 0, max: 500, message: "Enter a plausible blood sugar value (0-500 mg/dL)." },
          core: true,
        },
        { name: "fastingBloodSugar", label: "67. Fasting Blood Sugar", type: "number", placeholder: "0 if not done", validation: { min: 0, max: 500, message: "Enter a plausible blood sugar value (0-500)." }, core: true },
        {
          name: "gttDipsi",
          label: "68. GTT/DIPSI (mg/dL)",
          type: "number",
          placeholder: "e.g., 140",
          validation: { min: 0, max: 400, message: "Enter a plausible DIPSI value (0-400 mg/dL)." },
          core: true,
        },
        { name: "gtt75_1hr", label: "69. GTT 75gm - 1hr", type: "number", core: true },
        { name: "gtt75_2hr", label: "69. GTT 75gm - 2hr", type: "number", core: true },
        { name: "gtt75_3hr", label: "69. GTT 75gm - 3hr", type: "number", core: true },
      ],
    },
    {
      kind: "grid",
      title: "ECHO Findings",
      valueColumns: [{ name: "result", label: "Result", type: "radio" }],
      rows: [
        { name: "mv", label: "70. MV" },
        { name: "tv", label: "71. TV" },
        { name: "pv", label: "72. PV" },
        { name: "av", label: "73. AV" },
      ],
    } as GridSectionConfig,
    {
      columns: 4,
      fields: [
        { name: "asd", label: "74. ASD", type: "radio", options: yesNo, core: true },
        { name: "vsd", label: "75. VSD", type: "radio", options: yesNo, core: true },
        { name: "mvp", label: "76. MVP", type: "radio", options: yesNo, core: true },
        { name: "pah", label: "77. PAH", type: "radio", options: yesNo, core: true },
        { name: "dysfunction", label: "78. Dysfunction", type: "radio", options: ["Systolic", "Diastolic"], core: true },
        { name: "lvefPercent", label: "79. LVEF (in %)", type: "number", placeholder: "e.g., 25-70", validation: { min: 0, max: 100, message: "LVEF should be between 0-100%." }, core: true },
      ],
    },
    {
      fields: [{ name: "additionalRemarks", label: "80. Additional Remarks", type: "textarea", core: true }],
    },
  ],
};
