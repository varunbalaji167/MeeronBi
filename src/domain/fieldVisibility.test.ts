import { describe, it, expect } from "vitest";
import { resolveVisibleFieldNames, getFieldsWithData, isCustomizable, getCustomizableFields } from "./fieldVisibility";
import { TabConfig } from "./tabs/types";
import { personalTab } from "./tabs/personal";
import { investigationTab } from "./tabs/investigation";
import { robsonTab } from "./tabs/robson";

const testTab: TabConfig = {
  key: "test",
  label: "Test",
  route: "test",
  sections: [
    {
      fields: [
        { name: "fullName", label: "Full Name", type: "text", core: true },
        { name: "mrn", label: "MRD", type: "text", core: true },
        { name: "religion", label: "Religion", type: "select", options: ["A", "B"] },
        { name: "profession", label: "Profession", type: "text" },
      ],
    },
  ],
};

describe("resolveVisibleFieldNames — what the STAFF editing form shows", () => {
  it("falls back to exactly the core fields when a hospital has never customized this tab (storedSelection is null)", () => {
    expect(resolveVisibleFieldNames(testTab, null)).toEqual(new Set(["fullName", "mrn"]));
  });

  it("uses the hospital's stored selection exactly as saved once one exists — not merged with anything else", () => {
    const stored = ["fullName", "mrn", "religion"];
    expect(resolveVisibleFieldNames(testTab, stored)).toEqual(new Set(stored));
  });

  it("hides a field with data if a hospital has since unchecked it", () => {
    const stored = ["fullName", "mrn"];
    expect(resolveVisibleFieldNames(testTab, stored).has("profession")).toBe(false);
  });
});

describe("getFieldsWithData — what the PATIENT's read-only view shows", () => {
  it("shows any field with a real value, regardless of the hospital's current field selection", () => {
    const data = { fullName: "Jane Doe", profession: "Teacher", religion: "" };
    const visible = getFieldsWithData(testTab, data);
    expect(visible.has("fullName")).toBe(true);
    expect(visible.has("profession")).toBe(true);
    expect(visible.has("religion")).toBe(false);
    expect(visible.has("mrn")).toBe(false);
  });
});

describe("isCustomizable / getCustomizableFields, checked against real tab configs", () => {
  it("getCustomizableFields returns every plain-section field, core or not", () => {
    const investigationFields = getCustomizableFields(investigationTab);
    expect(investigationFields.length).toBeGreaterThan(0);
    expect(investigationFields.every((f) => f.core)).toBe(true);
  });

  it("Investigation has nothing left to customize — every field on it is core", () => {
    expect(isCustomizable(investigationTab)).toBe(false);
  });

  it("Robson has no customizable fields either — all 6 questions are core by design", () => {
    expect(isCustomizable(robsonTab)).toBe(false);
  });

  it("Personal DOES have a real mix of core and optional fields, so its Customize Fields button has something to do", () => {
    expect(isCustomizable(personalTab)).toBe(true);
    const fields = getCustomizableFields(personalTab);
    expect(fields.some((f) => f.core)).toBe(true);
    expect(fields.some((f) => !f.core)).toBe(true);
  });
});
