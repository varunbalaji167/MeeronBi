import { describe, it, expect } from "vitest";
import { fieldIds } from "./fieldIds";

describe("fieldIds", () => {
  it("is deterministic, so label and control agree without sharing state", () => {
    expect(fieldIds("fullName", { hasError: true })).toEqual(fieldIds("fullName", { hasError: true }));
  });

  it("uses the bare field name when unscoped", () => {
    expect(fieldIds("fullName").inputId).toBe("fullName");
  });

  it("gives every repeating row a distinct id for the same field", () => {
    const ids = [0, 1, 2].map((i) => fieldIds("parity", { scope: `obstetric-${i}` }).inputId);
    expect(new Set(ids).size).toBe(3);
  });

  it("derives error, help and label ids that never equal the input id", () => {
    const ids = fieldIds("x");
    expect(new Set([ids.inputId, ids.errorId, ids.helpId, ids.labelId]).size).toBe(4);
  });

  describe("describedBy", () => {
    it("is undefined with neither error nor help, so no dangling attribute", () => {
      expect(fieldIds("x").describedBy).toBeUndefined();
    });

    it("names one id when only one element renders", () => {
      expect(fieldIds("x", { hasError: true }).describedBy).toBe("x-error");
      expect(fieldIds("x", { hasHelp: true }).describedBy).toBe("x-help");
    });

    it("space-joins both, error first", () => {
      expect(fieldIds("x", { hasError: true, hasHelp: true }).describedBy).toBe("x-error x-help");
    });
  });

  it("a scoped id cannot collide with a grid-cell id", () => {
    expect(fieldIds("x", { scope: "a-1" }).inputId).not.toBe(fieldIds("a-1__x").inputId);
  });
});
