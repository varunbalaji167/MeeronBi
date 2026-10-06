// Total resolvers: null on bad/missing data, never throw. See docs/ANALYTICS.md §2–§4.

import { FieldRef } from "./types";
import { computeAge, computeBmi } from "./derivedFields";

/** One patient's tab data, keyed by tabKey — matches CohortPatient["tabs"] in types.ts. */
export type PatientTabs = Record<string, Record<string, any>>;

/** Resolves a Ratio field's numeric value for one patient. `multiselectOption` isn't ratio, so always null. */
export function resolveRatioValue(ref: FieldRef, tabs: PatientTabs): number | null {
  switch (ref.kind) {
    case "stored": {
      const raw = tabs[ref.tabKey]?.[ref.fieldName];
      const n = Number(raw);
      return raw !== null && raw !== undefined && raw !== "" && Number.isFinite(n) ? n : null;
    }
    case "derived": {
      const personal = tabs["personal"] ?? {};
      if (ref.id === "age") {
        return computeAge({
          dob: personal.dob,
          dateOfDelivery: tabs["delivery"]?.dateOfDelivery,
          edd: personal.edd,
          usgEdd: personal.usgEdd,
        });
      }
      return computeBmi(personal.heightCm, personal.weightFirstVisitKg);
    }
    case "multiselectOption":
      return null;
  }
}

// Multiselect absent-vs-"No" resolution rule: see docs/ANALYTICS.md §3.
export function resolveCategoricalValue(ref: FieldRef, tabs: PatientTabs): string | null {
  switch (ref.kind) {
    case "stored": {
      const value = tabs[ref.tabKey]?.[ref.fieldName];
      return typeof value === "string" && value.length > 0 ? value : null;
    }
    case "multiselectOption": {
      const value = tabs[ref.tabKey]?.[ref.fieldName];
      if (value === undefined || value === null) return null;
      if (!Array.isArray(value)) return null; // malformed data — can't determine inclusion, don't guess
      return value.includes(ref.option) ? "Yes" : "No";
    }
    case "derived":
      return null;
  }
}
