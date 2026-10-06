import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { computeRobsonGroup } from "@/domain/tabs";
import { computeAge, bucketTrimester } from "@/domain/analytics/derivedFields";
import { computeGestationalAge } from "@/domain/gestationalAge";
import { NAME_PATTERN, RECORD_NUMBER_PATTERN } from "@/domain/textPatterns";
import {
  mapRegister,
  mapRegisterRow,
  normalizeBloodGroup,
  parseCsv,
  parsePog,
  parseRegisterDate,
  parseRegisterTime,
  parseRobson,
  syntheticIdentity,
  type RegisterRow,
} from "./mapRegisterRow";

/** A plain elective CS for CPD in a first pregnancy; each test overrides only the columns it's about. */
function registerRow(overrides: Partial<RegisterRow> = {}): RegisterRow {
  return {
    "ID NO": "1",
    AGE: "29",
    District: "Imphal West",
    DOS: "29/05/20",
    DOB: "29.05.20",
    GRAVIDA: "1",
    PARITY: "0",
    ABORTIONS: "",
    POG: "39.1",
    "PREGNANCY COMPLICATIONS": "",
    "NO OF CS": "0",
    "SPON LABOUR": "NO",
    INDUCED: "",
    ELECTIVE: "YES",
    EMERGENCY: "",
    "INDCATIONS OF CESAREAN": "CPD",
    ROBSON: "2",
    "SEX OF BABY 1": "MALE",
    "WEIGHT 1": "3.1",
    TOB: "7.01 AM",
    AS: "9",
    CMF: "NO",
    "BLOOG GROUP": "B+ VE",
    "TSH 1": "2.8",
    ...overrides,
  };
}

function mapped(overrides: Partial<RegisterRow> = {}) {
  const result = mapRegisterRow(registerRow(overrides));
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("parseCsv", () => {
  it("keeps commas inside quoted cells, which every multi-item register column relies on", () => {
    const [row] = parseCsv('ID NO,OPERATIVE FINDINGS\n1,"MSL, SMALL FIBROIDS"\n');
    expect(row["OPERATIVE FINDINGS"]).toBe("MSL, SMALL FIBROIDS");
  });

  it("keeps the first of a repeated header — the register lists INDCATIONS OF CESAREAN twice and the first copy is the fuller one", () => {
    const [row] = parseCsv("A,B,A\nfirst,x,second\n");
    expect(row.A).toBe("first");
  });
});

describe("parseRegisterDate", () => {
  it("reads every day-first style the register mixes", () => {
    expect(parseRegisterDate("29.05.20")).toBe("2020-05-29");
    expect(parseRegisterDate("14/08/20")).toBe("2020-08-14");
    expect(parseRegisterDate("13.8.20")).toBe("2020-08-13");
    expect(parseRegisterDate("28/5/2020")).toBe("2020-05-28");
  });

  it("rejects impossible dates instead of silently rolling them into the next month", () => {
    expect(parseRegisterDate("31/02/20")).toBeNull();
    expect(parseRegisterDate("NOT DONE")).toBeNull();
  });
});

describe("parseRegisterTime", () => {
  it("converts the register's 12-hour times, with either separator, to the form's 24-hour HH:MM", () => {
    expect(parseRegisterTime("7.01 AM")).toBe("07:01");
    expect(parseRegisterTime("8:18 AM")).toBe("08:18");
    expect(parseRegisterTime("2.30PM")).toBe("14:30");
    expect(parseRegisterTime("7.54am")).toBe("07:54");
  });

  it("treats 12 PM as noon and 12 AM as midnight", () => {
    expect(parseRegisterTime("12.32PM")).toBe("12:32");
    expect(parseRegisterTime("12.05 AM")).toBe("00:05");
  });
});

describe("parsePog", () => {
  it("reads weeks.days, so 39.1 is 39 weeks 1 day rather than 39.1 weeks", () => {
    expect(parsePog("39.1")).toEqual({ weeks: 39, days: 1 });
    expect(parsePog("37")).toEqual({ weeks: 37, days: 0 });
  });

  it("accepts a capital O typed for zero, but not a days digit above 6", () => {
    expect(parsePog("38.O")).toEqual({ weeks: 38, days: 0 });
    expect(parsePog("38.9")).toBeNull();
  });
});

describe("normalizeBloodGroup", () => {
  it("collapses the register's spacing and +VE/-VE suffixes onto the Investigation tab's options", () => {
    expect(normalizeBloodGroup("A +VE")).toBe("A+");
    expect(normalizeBloodGroup("AB+ve")).toBe("AB+");
    expect(normalizeBloodGroup("B-VE")).toBe("B-");
    expect(normalizeBloodGroup("unknown")).toBeNull();
  });
});

describe("parseRobson", () => {
  it("separates the group from its A/B subgroup and treats NA as unrecorded", () => {
    expect(parseRobson("4A")).toEqual({ group: 4, subgroup: "A" });
    expect(parseRobson("10")).toEqual({ group: 10, subgroup: null });
    expect(parseRobson("NA")).toBeNull();
  });
});

describe("syntheticIdentity", () => {
  it("gives every source ID its own stable name and MRD", () => {
    const ids = Array.from({ length: 119 }, (_, i) => i + 1);
    expect(new Set(ids.map((id) => syntheticIdentity(id).fullName)).size).toBe(ids.length);
    expect(syntheticIdentity(7)).toEqual(syntheticIdentity(7));
  });

  it("produces values the Personal tab's own name and MRD validation accepts", () => {
    const identity = syntheticIdentity(42);
    expect(identity.fullName).toMatch(NAME_PATTERN);
    expect(identity.mrn).toMatch(RECORD_NUMBER_PATTERN);
  });
});

describe("mapRegisterRow", () => {
  it("never carries the register's identifying columns into any tab", () => {
    const patient = mapped({ NAME: "REAL PERSON", MRD: "207843", MOBILE: "9774157228", ADDRESS: "SAGOLBAND" });
    const stored = JSON.stringify(patient.tabs);
    for (const value of ["REAL PERSON", "207843", "9774157228", "SAGOLBAND"]) expect(stored).not.toContain(value);
  });

  it("skips a row it can't place in time, with a reason, rather than inventing dates", () => {
    const result = mapRegisterRow(registerRow({ DOB: "", DOS: "", "ID NO": "50" }));
    expect(result.ok).toBe(false);
  });

  describe("Personal", () => {
    it("reconstructs a DOB from AGE so the Age analytic gives back exactly that age at delivery", () => {
      const { personal, delivery } = mapped({ AGE: "29" }).tabs;
      expect(computeAge({ dob: personal!.dob as string, dateOfDelivery: delivery!.dateOfDelivery as string })).toBe(29);
    });

    it("derives LMP from POG at delivery, and EDD as LMP + 280 days", () => {
      const { personal } = mapped({ POG: "39.1", DOB: "29.05.20" }).tabs;
      expect(computeGestationalAge(personal!.lmp as string, new Date("2020-05-29"))).toMatchObject({ weeks: 39, days: 1 });
      expect(personal!.edd).toBe("2020-06-04");
    });

    it("prefers the baby's DOB over the surgery date when they disagree, and notes it", () => {
      const patient = mapped({ DOS: "30/07/20", DOB: "07.08.20" });
      expect(patient.tabs.delivery!.dateOfDelivery).toBe("2020-08-07");
      expect(patient.notes.join()).toMatch(/baby's DOB/);
    });
  });

  describe("History", () => {
    it("infers blank abortions as gravida − 1 − parity and builds a TPAL obstetric index", () => {
      const { history } = mapped({ GRAVIDA: "4", PARITY: "1", ABORTIONS: "", ROBSON: "4" }).tabs;
      expect(history!.noSponAbortions).toBe("2");
      expect(history!.obstetricIndex).toBe("G4P1021");
    });

    it("maps named complications to their options and keeps the rest as free text", () => {
      const { history } = mapped({ "PREGNANCY COMPLICATIONS": "GDM, HYPOTHYROIDISM, OLIGO" }).tabs;
      expect(history!.pregnancyComplications).toEqual(["GDM"]);
      expect(history!.medicalHistory).toEqual(["Thyroid disorder"]);
      expect(history!.pregnancyComplicationsOthers).toBe("OLIGO");
    });

    it("leaves medical history unset when the register's medical columns are all blank, since blank isn't 'none'", () => {
      expect(mapped().tabs.history!.medicalHistory).toBeUndefined();
      expect(mapped({ "MEDICAL COMPLICATIONS": "NO" }).tabs.history!.medicalHistory).toEqual([]);
    });
  });

  describe("Robson", () => {
    it("classifies an elective CS in a first pregnancy as group 2 with pre-labour onset", () => {
      const { robson } = mapped().tabs;
      expect(robson!.onsetOfLabour).toBe("Pre-labour CS");
      expect(computeRobsonGroup(robson!)).toBe(2);
    });

    it("lets the A/B subgroup decide onset for groups 2 and 4, even over the ELECTIVE column", () => {
      const { robson } = mapped({ GRAVIDA: "2", PARITY: "1", ROBSON: "4A", ELECTIVE: "YES" }).tabs;
      expect(robson!.onsetOfLabour).toBe("Induced");
      expect(computeRobsonGroup(robson!)).toBe(4);
    });

    it("trusts the register's own Robson group over a contradicting NO OF CS, and says so", () => {
      const patient = mapped({ GRAVIDA: "2", PARITY: "1", "NO OF CS": "1", "SPON LABOUR": "YES", ELECTIVE: "NO", ROBSON: "3" });
      expect(computeRobsonGroup(patient.tabs.robson!)).toBe(3);
      expect(patient.tabs.history!.noCesareanDelivery).toBe("0");
      expect(patient.notes.join()).toMatch(/Robson group 3 rules out a previous CS/);
    });

    it("caps NO OF CS at parity, since a hysterotomy scar isn't a delivery", () => {
      const patient = mapped({ GRAVIDA: "5", PARITY: "2", ABORTIONS: "2", "NO OF CS": "3", ROBSON: "5" });
      expect(patient.tabs.robson!.previousCs).toBe("Two or more Previous CS");
      expect(patient.tabs.history!.noCesareanDelivery).toBe("2");
    });

    it("makes a pregnancy with a second baby Multiple, which is group 8 whatever else applies", () => {
      const patient = mapped({ ROBSON: "8", "SEX OF BABY 2": "FEMALE", "WEIGHT 2": "2.7" });
      expect(computeRobsonGroup(patient.tabs.robson!)).toBe(8);
      expect(patient.tabs.delivery!.noOfBabies).toBe("2");
    });

    it("computes the group from the columns when the register has none (a preterm birth is group 10)", () => {
      const patient = mapped({ ROBSON: "NA", POG: "36.3", GRAVIDA: "2", PARITY: "1", "NO OF CS": "1", "SPON LABOUR": "YES" });
      expect(computeRobsonGroup(patient.tabs.robson!)).toBe(10);
    });
  });

  describe("Delivery", () => {
    it("maps CS indications onto the Delivery tab's options and reports wording that has no option", () => {
      const patient = mapped({ "INDCATIONS OF CESAREAN": "PROM, CPD" });
      expect(patient.tabs.delivery!.indicationsOfCs).toEqual(["CPD"]);
      expect(patient.unmappedCsIndications).toEqual(["PROM"]);
    });

    it("reads 'CS on demand' as maternal choice, not as a previous CS", () => {
      expect(mapped({ "INDCATIONS OF CESAREAN": "CS ON DEMAND" }).tabs.delivery!.indicationsOfCs).toEqual(["None: By Choice"]);
      expect(mapped({ "INDCATIONS OF CESAREAN": "POST CS, NOT WILLING VBAC", ROBSON: "5", PARITY: "1", GRAVIDA: "2", "NO OF CS": "1" }).tabs.delivery!.indicationsOfCs).toEqual(
        expect.arrayContaining(["Previous CS", "None: By Choice"])
      );
    });

    it("treats haemorrhage or its surgical control in the operative findings as PPH", () => {
      const { delivery } = mapped({ "OPERATIVE FINDINGS": "ATONIC UTERUS, BL UTERINE ARTERY LIGATION" }).tabs;
      expect(delivery!.postPartumComplications).toBe("PPH");
    });

    it("leaves delivery mode blank when nothing in the row shows a CS happened", () => {
      const patient = mapped({ "INDCATIONS OF CESAREAN": "", ROBSON: "NA" });
      expect(patient.tabs.delivery!.deliveryMode).toBeUndefined();
    });
  });

  describe("Investigation", () => {
    it("reads a 75 g OGTT triple as fasting / 1 h / 2 h, skipping an 'X' draw", () => {
      const { investigation } = mapped({ "GTT 75 GM": "137/X/187" }).tabs;
      expect(investigation).toMatchObject({ fastingBloodSugar: 137, gtt75_2hr: 187 });
      expect(investigation!.gtt75_1hr).toBeUndefined();
    });

    it("keeps 'ND'/'NOT DONE' out of numeric lab values", () => {
      const patient = mapped({ "TSH 1": "ND" });
      expect(patient.tabs.investigation!.tsh__level).toBeUndefined();
      expect(patient.tabs.treatments).toBeUndefined();
    });
  });

  describe("Ultrasound", () => {
    it("records every soft marker at its normal finding for a normal anomaly scan (nasal bone present, the rest absent)", () => {
      const { ultrasound } = mapped({ "ANOMALY SCAN": "NORMAL" }).tabs;
      expect(ultrasound).toMatchObject({ nasalBone__presence: "Positive", eif__presence: "Negative", nft__presence: "Negative" });
    });

    it("flips a marker the scan mentions and keeps its measurement", () => {
      const { ultrasound } = mapped({ "ANOMALY SCAN": "NFT=6.4" }).tabs;
      expect(ultrasound).toMatchObject({ nft__presence: "Positive", nft__sizeLocation: "6.4 mm" });
    });

    it("pulls AFI and placenta site out of the summary and keeps other findings as remarks", () => {
      const { ultrasound } = mapped({ "ANOMALY SCAN": "TWO FIBROID, AFI/LIQUOR=17.3" }).tabs;
      expect(ultrasound).toMatchObject({ afi1: 17.3, abnormalRemarks: "Anomaly scan: TWO FIBROID" });
      expect(mapped({ "ANOMALY SCAN": "PLACENTA = LEFT ANTERO LATERAL" }).tabs.ultrasound!.placenta1).toBe("Lateral");
    });
  });

  describe("Treatments", () => {
    it("places the undated TSH readings one per trimester, so time-series analytics can bucket them", () => {
      const { personal, treatments } = mapped({ "TSH 1": "2.8", "TSH 2": "1.87", "TSH 3": "3.14" }).tabs;
      const rows = treatments!.measurements as { date: string; tsh: number }[];
      expect(rows.map((r) => bucketTrimester(personal!.lmp as string, r.date))).toEqual(["t1", "t2", "t3"]);
      expect(rows.map((r) => r.tsh)).toEqual([2.8, 1.87, 3.14]);
    });

    it("records a Thyronorm dose as a daily levothyroxine course", () => {
      const { treatments } = mapped({ "THYRONORM 1": "25", "HYPOTHYROID/SCH": "YES" }).tabs;
      expect(treatments!.courses).toEqual([
        { condition: "Hypothyroidism", drug: "Thyronorm (levothyroxine) 25 mcg", dosage: 1, unit: "tablet", frequency: 1, perDays: "day" },
      ]);
    });
  });
});

describe("mapRegister on the committed 2020 register", () => {
  const csv = fs.readFileSync(path.join(__dirname, "register-2020.csv"), "utf8");
  const { patients, skipped } = mapRegister(csv);
  const rowsById = new Map(parseCsv(csv).map((row) => [Number(row["ID NO"]), row]));

  it("maps every row except the register's one blank line, which it reports", () => {
    expect(patients).toHaveLength(60);
    expect(skipped).toEqual([expect.stringMatching(/^ID 50:/)]);
  });

  it("produces only values the forms themselves would accept — nothing altered or dropped by the save path", () => {
    const rejected = patients.flatMap((p) => p.notes).filter((n) => /isn't valid|dropped/.test(n));
    expect(rejected).toEqual([]);
  });

  it("reproduces the clinician's own Robson group for every row that records one", () => {
    for (const patient of patients) {
      const recorded = parseRobson(rowsById.get(patient.sourceId)!.ROBSON);
      if (recorded) expect(computeRobsonGroup(patient.tabs.robson!), `ID ${patient.sourceId}`).toBe(recorded.group);
    }
  });

  it("gives every patient a distinct MRD", () => {
    expect(new Set(patients.map((p) => p.identity.mrn)).size).toBe(patients.length);
  });
});
