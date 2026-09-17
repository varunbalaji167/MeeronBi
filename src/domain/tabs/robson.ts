import { TabConfig } from "./types";

export const robsonTab: TabConfig = {
  key: "robson",
  label: "Robson",
  route: "robson",
  validateForComplete: (data) =>
    computeRobsonGroup(data) ? [] : ["All 6 Robson classification questions must be answered"],
  sections: [
    {
      columns: 3,
      fields: [
        // All 6 fields are `core: true` deliberately: Robson is a small,
        // fixed clinical instrument (not a long optional form like the
        // other tabs), so there's no meaningful "customize fields" story
        // here — either a hospital uses it or hides the whole tab.
        { name: "parity", label: "1. Parity", type: "radio", options: ["Nullipara", "Multipara"], core: true },
        { name: "previousCs", label: "2. Previous CS", type: "radio", options: ["None", "One Previous CS", "Two or more Previous CS"], core: true },
        { name: "numberOfFetuses", label: "3. Number of fetuses", type: "radio", options: ["Singleton", "Multiple"], core: true },
        { name: "fetalPresentation", label: "4. Fetal presentation or lie", type: "radio", options: ["Cephalic", "Breech", "Transverse or Oblique lie"], core: true },
        { name: "gestationalAge", label: "5. Gestational age (weeks)", type: "radio", options: ["Preterm: Less than 37 weeks", "Term: 37 weeks or more"], core: true },
        { name: "onsetOfLabour", label: "6. Onset of labour", type: "radio", options: ["Spontaneous", "Induced", "Pre-labour CS"], core: true },
      ],
    },
  ],
};

/**
 * Standard Robson Ten-Group Classification System (TGCS) logic, per WHO
 * guidance. Pure function of the six answers above — no I/O, easy to unit
 * test in isolation.
 */
export function computeRobsonGroup(d: Record<string, any>): number | null {
  const { parity, previousCs, numberOfFetuses, fetalPresentation, gestationalAge, onsetOfLabour } = d;
  if (!parity || !previousCs || !numberOfFetuses || !fetalPresentation || !gestationalAge || !onsetOfLabour) {
    return null;
  }
  if (numberOfFetuses === "Multiple") return 8;
  if (fetalPresentation === "Transverse or Oblique lie") return 9;
  if (fetalPresentation === "Breech") {
    return parity === "Nullipara" ? 6 : 7;
  }
  // Cephalic, singleton from here on
  if (gestationalAge === "Preterm: Less than 37 weeks") return 10;
  if (parity === "Nullipara") {
    if (onsetOfLabour === "Spontaneous") return 1;
    if (onsetOfLabour === "Induced" || onsetOfLabour === "Pre-labour CS") return 2;
    return 1;
  }
  // Multipara
  if (previousCs === "None") {
    if (onsetOfLabour === "Spontaneous") return 3;
    return 4; // induced or pre-labour CS
  }
  // one or more previous CS
  return 5;
}
