import { FieldConfig, RepeatingSectionConfig, TabConfig } from "./types";
import { countOptions } from "./sharedOptions";

const obstetricHistoryRowFields: FieldConfig[] = [
  { name: "conception", label: "Conception", type: "select", options: ["Spontaneous", "IUI", "IVF", "ICSI"] },
  { name: "complications", label: "Complications", type: "select", options: ["None", "Miscarriage", "Preterm labour", "PIH", "GDM", "Other"] },
  { name: "outcome", label: "Outcome", type: "select", options: ["Live birth", "Stillbirth", "Miscarriage", "MTP", "Ectopic"] },
  { name: "date", label: "Date", type: "date" },
  { name: "gestAgeWeeks", label: "Gest. Age (Weeks)", type: "select", options: Array.from({ length: 43 }, (_, i) => String(i)) },
  { name: "management", label: "Management", type: "select", options: ["Vaginal", "Caesarean", "Instrumental", "MTP/D&C", "Expectant"] },
  { name: "remarks", label: "Remarks", type: "textarea" },
  { name: "noOfBabies", label: "No. of Babies", type: "select", options: ["0", "1", "2", "3"] },
  { name: "weight1Kg", label: "Weight 1 (Kg)", type: "number", placeholder: "e.g., 2.45" },
  { name: "gender1", label: "Gender 1", type: "select", options: ["Male", "Female"] },
  { name: "weight2Kg", label: "Weight 2 (Kg)", type: "number", placeholder: "e.g., 2.45" },
  { name: "gender2", label: "Gender 2", type: "select", options: ["Male", "Female"] },
  { name: "weight3Kg", label: "Weight 3 (Kg)", type: "number", placeholder: "e.g., 2.45" },
  { name: "gender3", label: "Gender 3", type: "select", options: ["Male", "Female"] },
];

export const historyTab: TabConfig = {
  key: "history",
  label: "History",
  route: "history",
  requiredFields: ["obstetricIndex"],
  sections: [
    {
      columns: 4,
      fields: [
        { name: "dateOfWedding", label: "25. Date of Wedding", type: "date" },
        { name: "obstetricIndex", label: "26. GARVIDA/Obstetric Index", type: "text", placeholder: "G1P0000", core: true },
        { name: "infertilityType", label: "27. Infertility Type", type: "select", options: ["None", "Primary", "Secondary"] },
        { name: "conceptionType", label: "28. Conception Type", type: "select", options: ["Spontaneous", "IUI", "IVF", "ICSI"] },

        { name: "oicMethod", label: "29. OIC Method", type: "multiselect", options: ["Clomiphene", "FSH", "HMG", "Letrozole", "Gonadotropins"] },
        { name: "noOfBoys", label: "30. No of Boys", type: "select", options: countOptions },
        { name: "noOfGirls", label: "31. No of Girls", type: "select", options: countOptions },
        { name: "noCesareanDelivery", label: "32. No. Cesarean delivery", type: "select", options: countOptions },

        { name: "noVaginalDelivery", label: "33. No. Vaginal delivery", type: "select", options: countOptions },
        { name: "lastChildbirth", label: "34. Last Childbirth", type: "select", options: ["<1 year ago", "1-2 years ago", "2-5 years ago", ">5 years ago", "N/A - first pregnancy"] },
        { name: "noSponAbortions", label: "35. No. of Spon. Abortions", type: "select", options: countOptions },
        { name: "noMtp", label: "36. No. of MTP", type: "select", options: countOptions },

        { name: "reasonForMtp", label: "37. Reason for MTP", type: "select", options: ["N/A", "Fetal anomaly", "Medical indication", "Personal choice", "Other"] },
      ],
    },
    {
      columns: 3,
      fields: [
        { name: "medicalHistory", label: "38. Medical History", type: "multiselect", options: ["APLA", "Athritis", "Bronchial Asthma", "Cardiac Disease", "Diabetes", "Hypertension", "Thyroid disorder", "Epilepsy"], core: true },
        { name: "medicalHistoryOthers", label: "Others", type: "text", placeholder: "E.g., Jaudice" },
        { name: "surgicalHistory", label: "39. Surgical History", type: "multiselect", options: ["Appendicectomy", "Cholecystectomy", "Ectopic", "Kidney surgery", "Caesarean"] },
        { name: "surgicalHistoryOthers", label: "Others", type: "text", placeholder: "E.g., Eye" },
        { name: "pregnancyComplications", label: "40. Pregnancy Complications", type: "multiselect", options: ["Abruption", "Breech", "Cholestasis", "PIH", "GDM", "Placenta Previa"], core: true },
        { name: "pregnancyComplicationsOthers", label: "Others", type: "text", placeholder: "E.g., bleeding" },
      ],
    },
    {
      kind: "repeating",
      name: "obstetricHistory",
      title: "41. Obstetric History",
      columnLabelPrefix: "G",
      fixedCount: 6,
      fields: obstetricHistoryRowFields,
    } as RepeatingSectionConfig,
  ],
};
