import { RepeatingSectionConfig, TabConfig } from "./types";

export const treatmentsTab: TabConfig = {
  key: "treatments",
  label: "Treatments",
  route: "treatments",
  // No plain-section fields at all — both sections are repeating tables —
  // so this tab has nothing for "customize fields" to toggle. See
  // domain/fieldVisibility.ts for how that's decided.
  sections: [
    {
      kind: "repeating",
      name: "measurements",
      title: "Measurements",
      addRowLabel: "Add visit",
      fields: [
        { name: "date", label: "Date", type: "date" },
        { name: "pogWeeks", label: "POG (Weeks)", type: "number", helpText: "Auto-computed from LMP if left blank", validation: { min: 0, max: 45, message: "POG should be between 0-45 weeks." } },
        { name: "weightKg", label: "Weight (kg)", type: "number" },
        { name: "bmi", label: "BMI", type: "number", placeholder: "e.g., 20" },
        { name: "bpHigh", label: "BP High", type: "number" },
        { name: "bpLow", label: "BP Low", type: "number" },
        { name: "tsh", label: "TSH (mU/L)", type: "number" },
        { name: "freeT4", label: "Free T4", type: "number" },
        { name: "sugarFasting", label: "Sugar (Fasting)", type: "number" },
        { name: "sugarPp", label: "Sugar (PP)", type: "number" },
      ],
    } as RepeatingSectionConfig,
    {
      kind: "repeating",
      name: "courses",
      title: "Treatment for Medical Conditions During Pregnancy",
      addRowLabel: "Add course",
      fields: [
        { name: "startDate", label: "Course starts on", type: "date" },
        { name: "pogWeeks", label: "POG (Weeks)", type: "number", helpText: "Auto-computed from LMP if left blank", validation: { min: 0, max: 45, message: "POG should be between 0-45 weeks." } },
        { name: "condition", label: "Condition", type: "text", placeholder: "e.g., Bronchial asthma" },
        { name: "drug", label: "Drug", type: "text", placeholder: "e.g., Metformin SR" },
        { name: "dosage", label: "Dosage", type: "number" },
        { name: "unit", label: "Unit", type: "select", options: ["mg", "g", "ml", "IU", "tablet"] },
        { name: "frequency", label: "Frequency", type: "number" },
        { name: "perDays", label: "per # days", type: "select", options: ["day", "week", "month"] },
        { name: "gapsHrs", label: "Gaps (hrs)", type: "number" },
        { name: "instructions", label: "Instructions", type: "text" },
        { name: "courseDays", label: "Course (Days)", type: "number" },
      ],
    } as RepeatingSectionConfig,
  ],
};
