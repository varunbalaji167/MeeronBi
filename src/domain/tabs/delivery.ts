import { TabConfig } from "./types";
import { yesNo } from "./sharedOptions";

// The source spec's Delivery page carries zero red dots anywhere (unlike
// Personal/History/Investigation) — its caption instead reads "Active only
// at the delivery time", describing a different concept (this tab's real
// relevance) rather than the usual shown-by-default/customizable split.
// `core` here is therefore kept aligned with `requiredFields` below, not
// with the page's (absent) red dots: a required-to-complete field must
// never be hideable via "Customize fields", or Mark Complete would become
// permanently unreachable for a hospital that hid it. apgarScore and
// nicuAdmission are core for the same "don't let this disappear"
// pragmatic reason even though they aren't required, since they're two of
// the handful of fields every delivery record realistically needs.
export const deliveryTab: TabConfig = {
  key: "delivery",
  label: "Delivery",
  route: "delivery",
  requiredFields: ["dateOfDelivery", "deliveryMode", "babyWeightKg", "sexOfBaby"],
  sections: [
    {
      columns: 4,
      fields: [
        { name: "admissionType", label: "Admission Type", type: "radio", options: ["Emergency", "Routine"] },
        { name: "medicoLegalCase", label: "Medico Legal Case?", type: "radio", options: ["MLC", "Non-MLC"] },
        { name: "garvidaNo", label: "117. GARVIDA No.", type: "select", options: ["G1", "G2", "G3", "G4", "G5", "G6+"] },
        { name: "dateOfDelivery", label: "127. Date of Delivery", type: "date", core: true },

        { name: "pogOnDeliveryWeeks", label: "118. POG on Delivery (Weeks)", type: "number", validation: { min: 20, max: 44, message: "POG should be between 20-44 weeks." } },
        { name: "labourType", label: "119. Labour Type", type: "select", options: ["Spontaneous", "Induced", "Elective CS"] },
        { name: "indication", label: "120. Indication", type: "select", options: ["N/A", "Fetal distress", "Failure to progress", "Post-dates", "PIH", "GDM"] },
        { name: "method", label: "121. Method", type: "select", options: ["N/A", "PGE2 gel", "Oxytocin", "Foley catheter", "ARM"] },

        { name: "timesInduced", label: "122. # Times Induced", type: "select", options: ["0", "1", "2", "3+"] },
        { name: "deliveryMode", label: "123. Delivery Mode", type: "select", options: ["Vaginal", "Instrumental", "Caesarean"], core: true },
        { name: "indicationForInstDelivery", label: "124. Indication for Inst. Delivery", type: "select", options: ["N/A", "Fetal distress", "Prolonged 2nd stage", "Maternal exhaustion"] },
        { name: "noOfBabies", label: "126. No. of Babies", type: "select", options: ["1", "2", "3+"] },

        { name: "indicationsOfCs", label: "125. Indications of CS", type: "multiselect", options: ["None: By Choice", "Abdominal Pain", "Breech", "Fetal distress", "Failed induction", "Previous CS", "CPD"] },
        { name: "timeOfDelivery", label: "128. Time of Delivery", type: "time" },
        { name: "babyWeightKg", label: "129. Weight of the Baby (Kg)", type: "number", placeholder: "e.g., 2.4", validation: { min: 0.3, max: 6, message: "Baby weight should be between 0.3-6 kg." }, core: true },
        { name: "sexOfBaby", label: "130. Sex of Baby", type: "select", options: ["Male", "Female", "Ambiguous"], core: true },

        { name: "apgarScore", label: "131. Apgar score", type: "number", placeholder: "A score between 1-10", validation: { min: 0, max: 10, message: "Apgar score should be between 0-10." }, core: true },
        { name: "cmf", label: "132. CMF", type: "text", placeholder: "Any Congenital malformations" },
        { name: "nicuAdmission", label: "133. NICU admission", type: "select", options: yesNo, core: true },
        { name: "neonatalComplications", label: "134. Neonatal complications", type: "select", options: ["None", "Birth asphyxia", "Jaundice", "RDS", "Sepsis", "Other"] },

        { name: "labourComplications", label: "135. Labour complications", type: "select", options: ["None", "PPH", "Obstructed labour", "Uterine rupture", "Cord prolapse", "Other"] },
        { name: "postPartumComplications", label: "136. Post Partum/operation Complications", type: "select", options: ["None", "PPH", "Infection", "Wound dehiscence", "Other"] },
        { name: "hospitalNameAddress", label: "137. Hospital Name & Address", type: "textarea", placeholder: "e.g., RIMS, Lamphel, Imphal West, Manipur" },
      ],
    },
  ],
};

/**
 * Per the source spec's Delivery page caption ("Normal delivery is 37-40
 * weeks, premature delivery before 37 and late delivery after 40 weeks"):
 * classifies delivery timing from "118. POG on Delivery (Weeks)". Pure and
 * live-computed — see TabRecordView's `deliveryTiming`, shown the same way
 * Robson's live classification result is (an `extra` panel below the
 * form), rather than gating anything: this is a label, not a validation
 * rule, consistent with how the rest of this app treats clinical
 * categorization (informational, never blocking).
 */
export function classifyDeliveryTiming(pogWeeks: unknown): { label: string; tone: "warn" | "ok" } | null {
  const n = typeof pogWeeks === "string" ? parseFloat(pogWeeks) : typeof pogWeeks === "number" ? pogWeeks : NaN;
  if (Number.isNaN(n)) return null;
  if (n < 37) return { label: "Premature delivery (before 37 weeks)", tone: "warn" };
  if (n <= 40) return { label: "Normal delivery (37–40 weeks)", tone: "ok" };
  return { label: "Late delivery (after 40 weeks)", tone: "warn" };
}
