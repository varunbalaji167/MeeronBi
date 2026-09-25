import { describe, it, expect } from "vitest";
import { computeRobsonGroup } from "./robson";

// Each case below is a real Robson group definition (WHO Ten-Group
// Classification System), not an arbitrary input combination — read
// through these and you have the actual clinical logic this tab
// implements, not just "a function that returns a number".
describe("computeRobsonGroup", () => {
  it("returns null until all 6 questions are answered — this is what gates 'Mark Complete' for this tab", () => {
    expect(computeRobsonGroup({})).toBeNull();
    expect(computeRobsonGroup({ parity: "Nullipara" })).toBeNull();
  });

  const base = {
    parity: "Nullipara",
    previousCs: "None",
    numberOfFetuses: "Singleton",
    fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more",
    onsetOfLabour: "Spontaneous",
  };

  it("Group 1 — nulliparous, single cephalic, term, spontaneous labour", () => {
    expect(computeRobsonGroup(base)).toBe(1);
  });

  it("Group 2 — nulliparous, single cephalic, term, induced OR pre-labour CS", () => {
    expect(computeRobsonGroup({ ...base, onsetOfLabour: "Induced" })).toBe(2);
    expect(computeRobsonGroup({ ...base, onsetOfLabour: "Pre-labour CS" })).toBe(2);
  });

  it("Group 3 — multiparous (no previous CS), single cephalic, term, spontaneous", () => {
    expect(computeRobsonGroup({ ...base, parity: "Multipara" })).toBe(3);
  });

  it("Group 4 — multiparous (no previous CS), single cephalic, term, induced OR pre-labour CS", () => {
    expect(computeRobsonGroup({ ...base, parity: "Multipara", onsetOfLabour: "Induced" })).toBe(4);
  });

  it("Group 5 — any multiparous patient with a previous CS, single cephalic, term — onset of labour doesn't matter", () => {
    expect(
      computeRobsonGroup({ ...base, parity: "Multipara", previousCs: "One Previous CS", onsetOfLabour: "Spontaneous" })
    ).toBe(5);
    expect(
      computeRobsonGroup({ ...base, parity: "Multipara", previousCs: "Two or more Previous CS", onsetOfLabour: "Induced" })
    ).toBe(5);
  });

  it("Group 6 — all nulliparous breech, regardless of gestational age or onset", () => {
    expect(computeRobsonGroup({ ...base, fetalPresentation: "Breech" })).toBe(6);
  });

  it("Group 7 — all multiparous breech (including a previous CS)", () => {
    expect(computeRobsonGroup({ ...base, parity: "Multipara", fetalPresentation: "Breech" })).toBe(7);
    expect(
      computeRobsonGroup({ ...base, parity: "Multipara", previousCs: "One Previous CS", fetalPresentation: "Breech" })
    ).toBe(7);
  });

  it("Group 8 — every multiple pregnancy, and this takes priority over breech/transverse presentation", () => {
    expect(computeRobsonGroup({ ...base, numberOfFetuses: "Multiple" })).toBe(8);
    expect(computeRobsonGroup({ ...base, numberOfFetuses: "Multiple", fetalPresentation: "Breech" })).toBe(8);
  });

  it("Group 9 — every transverse/oblique lie, and this takes priority over preterm gestational age", () => {
    expect(computeRobsonGroup({ ...base, fetalPresentation: "Transverse or Oblique lie" })).toBe(9);
    expect(
      computeRobsonGroup({
        ...base,
        fetalPresentation: "Transverse or Oblique lie",
        gestationalAge: "Preterm: Less than 37 weeks",
      })
    ).toBe(9);
  });

  it("Group 10 — every single cephalic preterm birth, regardless of parity or onset", () => {
    expect(computeRobsonGroup({ ...base, gestationalAge: "Preterm: Less than 37 weeks" })).toBe(10);
    expect(
      computeRobsonGroup({ ...base, parity: "Multipara", previousCs: "One Previous CS", gestationalAge: "Preterm: Less than 37 weeks" })
    ).toBe(10);
  });
});
