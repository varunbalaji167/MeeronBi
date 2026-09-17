import { TabConfig } from "./types";
import { educationLevels, incomeBrackets } from "./sharedOptions";

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
        { name: "fullName", label: "1. Full Name", type: "text", placeholder: "e.g., Meikam Tombi Meitei", core: true },
        { name: "surname", label: "2. Surname", type: "text", placeholder: "Surname/Yumnak" },
        { name: "name", label: "3. Name", type: "text", placeholder: "Name/Ming" },
        {
          name: "mrn",
          label: "4. CR No./MRD",
          type: "text",
          placeholder: "Enter CR No./MRD",
          core: true,
          maxLength: 20,
          validation: {
            pattern: /^[A-Za-z0-9][A-Za-z0-9\-\/]{2,19}$/,
            message: "MRD should be 3-20 characters — letters, numbers, hyphens, or slashes only, starting with a letter or number.",
          },
        },

        // Stored as { countryIso, number } — see domain/phone.ts. Works for
        // any country's numbering plan rather than assuming one.
        { name: "contactNo", label: "5. Contact No.", type: "phone", icon: "phone", core: true },
        { name: "dob", label: "6. Date of Birth", type: "date", helpText: "Must be in the past.", core: true },
        { name: "lmp", label: "7. LMP", type: "date", core: true },
        { name: "edd", label: "8. EDD", type: "date", helpText: "Auto-suggested as LMP + 280 days; editable.", core: true },

        { name: "usgEdd", label: "9. USG EDD", type: "date" },
        { name: "heightCm", label: "10. Height (in Cm)", type: "number", placeholder: "e.g., 160", validation: { min: 120, max: 210, message: "Height should be between 120-210 cm." }, core: true },
        { name: "weightFirstVisitKg", label: "11. Wt. in First Visit (in Kg)", type: "number", placeholder: "e.g., 52", validation: { min: 30, max: 150, message: "Weight should be between 30-150 kg." }, core: true },
        { name: "weightLastVisitKg", label: "12. Wt. in Last Visit (in Kg)", type: "number", placeholder: "e.g., 60", validation: { min: 30, max: 150, message: "Weight should be between 30-150 kg." } },

        { name: "religion", label: "13. Religion", type: "text", placeholder: "e.g., Sanamahi" },
        { name: "profession", label: "14. Profession", type: "text", placeholder: "e.g., Police, Doctor, Nurse, Teacher" },
        { name: "highestEducation", label: "15. Highest Education", type: "select", options: educationLevels },
        { name: "income", label: "16. Income", type: "select", options: incomeBrackets },

        { name: "spouseName", label: "17. Spouse's Name", type: "text", placeholder: "Father of the baby" },
        { name: "spouseEducation", label: "18. Highest Education", type: "select", options: educationLevels },
        { name: "spouseOccupation", label: "19. Occupation", type: "text", placeholder: "e.g., Teacher" },
        { name: "spouseIncome", label: "20. Spouse's Income", type: "select", options: incomeBrackets },

        { name: "address", label: "21. Address", type: "text", placeholder: "e.g., Kongba Laishram Leikai" },
        { name: "landmark", label: "21a. Nearest Landmark", type: "text", placeholder: "e.g., Kongba Bridge" },
        { name: "cityTown", label: "22. City/Town", type: "text", placeholder: "e.g., Kongba" },
        { name: "district", label: "23. District", type: "text", placeholder: "e.g., Indore" },
        // Postal codes vary hugely by country (digits-only in some, alphanumeric
        // in others like Canada/UK) — kept as free text with a length cap
        // rather than a country-specific pattern, so this works globally.
        { name: "pin", label: "24. Postal / PIN Code", type: "text", placeholder: "e.g., 795005 or SW1A 1AA", icon: "location", maxLength: 12 },
      ],
    },
  ],
};
