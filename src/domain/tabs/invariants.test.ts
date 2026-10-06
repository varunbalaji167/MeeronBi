// Config invariants the form engine and validation silently rely on; a typo here
// otherwise surfaces as an un-completable tab or a missing required-field check.

import { describe, it, expect } from "vitest";
import { allTabs } from "./index";
import { isRepeatingSection } from "./types";
import { getCustomizableFields } from "../fieldVisibility";

const plainFields = (tab: (typeof allTabs)[number]) => getCustomizableFields(tab);

const allFields = (tab: (typeof allTabs)[number]) => [
  ...plainFields(tab),
  ...tab.sections.filter(isRepeatingSection).flatMap((s) => s.fields),
];

describe("tab config invariants", () => {
  it("every requiredFields entry names a real plain-section field", () => {
    for (const tab of allTabs) {
      const names = new Set(plainFields(tab).map((f) => f.name));
      for (const name of tab.requiredFields ?? []) {
        expect(names.has(name), `${tab.key}: requiredFields entry "${name}" is not a field`).toBe(true);
      }
    }
  });

  it("every requiredFields entry is core, so Customize fields can't hide it", () => {
    for (const tab of allTabs) {
      const byName = new Map(plainFields(tab).map((f) => [f.name, f]));
      for (const name of tab.requiredFields ?? []) {
        expect(byName.get(name)?.core, `${tab.key}: required field "${name}" must be core: true`).toBe(true);
      }
    }
  });

  it("every fieldValidators key names a real field on that tab", () => {
    for (const tab of allTabs) {
      const names = new Set(allFields(tab).map((f) => f.name));
      for (const key of Object.keys(tab.fieldValidators ?? {})) {
        expect(names.has(key), `${tab.key}: fieldValidators key "${key}" is not a field`).toBe(true);
      }
    }
  });

  it("plain-section field names are unique within a tab", () => {
    for (const tab of allTabs) {
      const seen = new Set<string>();
      for (const { name } of plainFields(tab)) {
        expect(seen.has(name), `${tab.key}: duplicate field name "${name}"`).toBe(false);
        seen.add(name);
      }
    }
  });

  it("no plain-section field name contains the id separators `__` or `--`", () => {
    for (const tab of allTabs) {
      for (const { name } of plainFields(tab)) {
        expect(/__|--/.test(name), `${tab.key}: field "${name}" contains "__" or "--"`).toBe(false);
      }
    }
  });

  it("every select/radio/multiselect field has a non-empty options array", () => {
    for (const tab of allTabs) {
      for (const f of allFields(tab)) {
        if (f.type !== "select" && f.type !== "radio" && f.type !== "multiselect") continue;
        expect(
          Array.isArray(f.options) && f.options.length > 0,
          `${tab.key}: ${f.type} field "${f.name}" has no options`,
        ).toBe(true);
      }
    }
  });

  it("allowOther appears only on select fields", () => {
    for (const tab of allTabs) {
      for (const f of allFields(tab)) {
        if (!f.allowOther) continue;
        expect(f.type, `${tab.key}: field "${f.name}" sets allowOther on type "${f.type}"`).toBe("select");
      }
    }
  });
});
