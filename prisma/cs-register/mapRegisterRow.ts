// Maps rows of a hospital caesarean-section (CS) register export onto MeeronBi's 7 tab payloads.
// Pure (no Prisma, no fs) so every mapping rule is unit-tested; prisma/seed-cs-register.ts does the writing.

import { computeRobsonGroup, getTabByKey } from "@/domain/tabs";
import { sanitizeTabData, validateAllFields } from "@/domain/validation";
import { err, ok, type Result } from "@/domain/result";

export type RegisterRow = Record<string, string>;
export type TabKey = "personal" | "history" | "investigation" | "ultrasound" | "delivery" | "robson" | "treatments";
export type TabData = Record<string, unknown>;

export interface SyntheticIdentity {
  fullName: string;
  surname: string;
  name: string;
  mrn: string;
}

export interface MappedPatient {
  /** The register's own "ID NO", kept only to trace a record back to its source row. */
  sourceId: number;
  identity: SyntheticIdentity;
  tabs: Partial<Record<TabKey, TabData>>;
  /** Register wording for a CS indication that has no matching option on the Delivery tab. */
  unmappedCsIndications: string[];
  /** Judgement calls and data-quality fixes worth showing whoever runs the seed. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Parsing the register's free-typed cells
// ---------------------------------------------------------------------------

/** Parses CSV text into header-keyed rows; a repeated header keeps its first column (the register repeats one). */
export function parseCsv(text: string): RegisterRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }

  const [header = [], ...body] = records;
  return body.map((cells) => {
    const row: RegisterRow = {};
    header.forEach((name, i) => {
      if (!(name in row)) row[name] = cells[i] ?? "";
    });
    return row;
  });
}

// The register's shorthands for "no value": not applicable, not done, not known.
const BLANK_MARKERS = new Set(["", "NA", "N/A", "ND", "NK", "NOT DONE"]);

function cell(row: RegisterRow, column: string): string | null {
  const value = (row[column] ?? "").trim();
  return BLANK_MARKERS.has(value.toUpperCase()) ? null : value;
}

function firstNumber(value: string | null): number | null {
  const match = value?.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function tokens(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

const isYes = (value: string | null) => /^(YES|Y)$/i.test(value ?? "");
// "N0" (zero for O) is a typo the register really contains.
const isNo = (value: string | null) => /^(NO|N|N0)$/i.test(value ?? "");

/** "29.05.20", "14/08/20", "29/05/2020" -> "2020-05-29" (day-first, as the register writes them); null if not a real date. */
export function parseRegisterDate(value: string | null): string | null {
  const match = value?.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}

/** "7.01 AM", "12.32PM", "8:18 AM" -> 24-hour "HH:MM". */
export function parseRegisterTime(value: string | null): string | null {
  const match = value?.trim().match(/^(\d{1,2})[.:](\d{2})\s*([AP])M$/i);
  if (!match) return null;
  const hour12 = Number(match[1]);
  if (hour12 < 1 || hour12 > 12 || Number(match[2]) > 59) return null;
  const hour = (hour12 % 12) + (match[3].toUpperCase() === "P" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

/** POG is written weeks.days ("39.1" = 39w1d); a capital O typed for zero ("38.O") is accepted. */
export function parsePog(value: string | null): { weeks: number; days: number } | null {
  const match = value?.trim().toUpperCase().replace(/O/g, "0").match(/^(\d{2})(?:\.(\d))?$/);
  if (!match) return null;
  const days = Number(match[2] ?? 0);
  return days <= 6 ? { weeks: Number(match[1]), days } : null;
}

/** "A +VE", "B+ VE", "AB+ve" -> the Investigation tab's "A+" style. */
export function normalizeBloodGroup(value: string | null): string | null {
  const match = value?.toUpperCase().replace(/\s+/g, "").match(/^(AB|A|B|O)([+-])(VE)?$/);
  return match ? `${match[1]}${match[2]}` : null;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addYears(isoDate: string, years: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

/** Screening reports are free text ("LOW RISK", "TRISOMY 21 = 1:90"); "Not done" is kept since it's a real answer. */
function screeningResult(row: RegisterRow, column: string): string | undefined {
  const value = (row[column] ?? "").trim();
  if (!value || /^N\/?A$/i.test(value)) return undefined;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function compact(data: Record<string, unknown>): TabData {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

// ---------------------------------------------------------------------------
// Synthetic identity
// ---------------------------------------------------------------------------

// Real names, MRDs, phone numbers and addresses are never read; every record gets a deterministic stand-in instead.
const SURNAMES = [
  "Laishram", "Thokchom", "Khumanthem", "Chongtham", "Salam", "Oinam", "Ningthoujam", "Huidrom", "Sorokhaibam", "Wahengbam",
  "Kshetrimayum", "Leishangthem", "Pukhrambam", "Soibam", "Sagolsem", "Maibam", "Akoijam", "Heisnam", "Keisham", "Mayengbam",
];
const GIVEN_NAMES = [
  "Bembem", "Sanatombi", "Thoibi", "Memcha", "Linthoi", "Bidyarani", "Premila", "Indira", "Romita", "Babita", "Shanti", "Leima",
  "Roshni", "Bijaya", "Sushila", "Malati", "Nganbi", "Sanahanbi", "Thadoi", "Prabhabati", "Rebati", "Lalita", "Kamala", "Abenao",
];

export function syntheticIdentity(sourceId: number): SyntheticIdentity {
  // Strides coprime to both list lengths keep every ID below lcm(20, 24) = 120 on a distinct name.
  const surname = SURNAMES[(sourceId * 7) % SURNAMES.length];
  const name = GIVEN_NAMES[(sourceId * 11) % GIVEN_NAMES.length];
  const suffix = sourceId % 3 === 0 ? "Chanu" : "Devi";
  return { fullName: `${surname} ${name} ${suffix}`, surname, name, mrn: `CSR-${String(sourceId).padStart(3, "0")}` };
}

// ---------------------------------------------------------------------------
// Clinical vocabulary: register wording -> tab options
// ---------------------------------------------------------------------------

const PREGNANCY_COMPLICATION_RULES: [RegExp, string][] = [
  [/\bPIH\b/, "PIH"],
  [/\bGDM\b/, "GDM"],
  [/CHOLESTASIS|\bIHCP\b/, "Cholestasis"],
  [/ABRUPTION/, "Abruption"],
  [/BREECH/, "Breech"],
  [/PREVIA/, "Placenta Previa"],
];
// Prior CS ("POST CS", "PREVIOUS 2 CS") is already counted by the NO OF CS column.
const CS_HISTORY_PATTERN = /\bCS\b/;
const OTHER_SURGERY_PATTERN = /HYSTEROTOMY|MYOMECTOMY|OPHORECTOMY|\bSO\b/;
const HYPOTHYROID_PATTERN = /HYPOTHYROID/;

const CS_INDICATION_RULES: [RegExp, string][] = [
  [/\bCPD\b/, "CPD"],
  [/ON DEMAND|NOT WILLING VBAC/, "None: By Choice"],
  [/^(?!CS ON DEMAND).*\bCS\b|VBAC/, "Previous CS"],
  [/FAILED INDUCTION/, "Failed induction"],
  [/FETAL (DISTRESS|BRADYCARDIA)/, "Fetal distress"],
  [/BREECH/, "Breech"],
];

// Operative findings that mean the CS was complicated by haemorrhage (or its surgical control).
const PPH_PATTERN = /PPH|ATONIC|ARTERY LIGATION|UT ART LIGATION/;

const MEDICAL_COLUMNS = ["MEDICAL COMPLICATIONS", "HYPOTHYROID/SCH", "DM/GDM", "BA", "CHR HTN"];

// A scan summary mentioning a marker flips it from its normal finding (an absent nasal bone is the marker).
const SOFT_MARKERS: { row: string; pattern: RegExp; normal: "Positive" | "Negative" }[] = [
  { row: "nft", pattern: /\bNFT\b/, normal: "Negative" },
  { row: "nasalBone", pattern: /NASAL BONE (ABSENT|NOT SEEN|HYPOPLASTIC)/, normal: "Positive" },
  { row: "eif", pattern: /\bEIF\b/, normal: "Negative" },
  { row: "pelvicaliectasis", pattern: /PELVICALIECTASIS/, normal: "Negative" },
  { row: "choroidPlexusCyst", pattern: /CHOROID PLEXUS/, normal: "Negative" },
  { row: "echogenicBowel", pattern: /ECHOGENIC BOWEL/, normal: "Negative" },
  { row: "lateralVentriclesSize", pattern: /VENTRICULOMEGALY|LATERAL VENTRICLE/, normal: "Negative" },
  { row: "singleUmbilicalArtery", pattern: /SINGLE UMBILICAL ARTERY|\bSUA\b/, normal: "Negative" },
];

const PLACENTA_LOCATIONS: [RegExp, string][] = [
  [/LOW/, "Low-lying"],
  [/FUNDAL/, "Fundal"],
  [/LATERAL/, "Lateral"],
  [/ANTER/, "Anterior"],
  [/POSTER/, "Posterior"],
];

// The register's TSH 1-3 are undated; one reading per trimester lets time-series analytics bucket them.
const TSH_READING_WEEKS = [10, 20, 30];

// ---------------------------------------------------------------------------
// Robson
// ---------------------------------------------------------------------------

const TERM = "Term: 37 weeks or more";
const PRETERM = "Preterm: Less than 37 weeks";

interface RobsonDeterminants {
  parity: string;
  previousCs: string;
  numberOfFetuses: string;
  fetalPresentation: string;
  gestationalAge: string;
  onsetOfLabour: string;
}

// What each WHO group fixes about its members (previous-CS count is reconciled numerically, before this).
const ROBSON_GROUP_IMPLIES: Record<number, Partial<RobsonDeterminants>> = {
  1: { parity: "Nullipara", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: TERM, onsetOfLabour: "Spontaneous" },
  2: { parity: "Nullipara", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: TERM },
  3: { parity: "Multipara", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: TERM, onsetOfLabour: "Spontaneous" },
  4: { parity: "Multipara", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: TERM },
  5: { numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: TERM },
  6: { parity: "Nullipara", numberOfFetuses: "Singleton", fetalPresentation: "Breech" },
  7: { parity: "Multipara", numberOfFetuses: "Singleton", fetalPresentation: "Breech" },
  8: { numberOfFetuses: "Multiple" },
  9: { numberOfFetuses: "Singleton", fetalPresentation: "Transverse or Oblique lie" },
  10: { numberOfFetuses: "Singleton", fetalPresentation: "Cephalic", gestationalAge: PRETERM },
};

/** "4", "4A", "2B" -> group + subgroup (A = induced, B = pre-labour CS); "NA" -> null. */
export function parseRobson(value: string | null): { group: number; subgroup: "A" | "B" | null } | null {
  const match = value?.trim().toUpperCase().match(/^(10|[1-9])([AB])?$/);
  return match ? { group: Number(match[1]), subgroup: (match[2] as "A" | "B" | undefined) ?? null } : null;
}

// ---------------------------------------------------------------------------
// Row -> tabs
// ---------------------------------------------------------------------------

/** Runs a payload through the app's own save-path cleaning; anything it would alter or reject is reported, not kept. */
export function finalizeTab(tabKey: TabKey, data: TabData, notes: string[]): TabData {
  const tab = getTabByKey(tabKey)!;
  const clean = sanitizeTabData(tab, data);
  for (const key of new Set([...Object.keys(data), ...Object.keys(clean)])) {
    if (JSON.stringify(data[key]) !== JSON.stringify(clean[key])) {
      notes.push(`${tabKey}.${key}: ${JSON.stringify(data[key])} isn't valid for this field; saved as ${JSON.stringify(clean[key] ?? null)}`);
    }
  }
  for (const [field, message] of Object.entries(validateAllFields(tab, clean))) {
    notes.push(`${tabKey}.${field} dropped: ${message}`);
    delete clean[field];
  }
  return clean;
}

export function mapRegisterRow(row: RegisterRow): Result<MappedPatient, string> {
  const sourceId = Number(cell(row, "ID NO"));
  const age = firstNumber(cell(row, "AGE"));
  const babyDob = parseRegisterDate(cell(row, "DOB"));
  const surgeryDate = parseRegisterDate(cell(row, "DOS"));
  const deliveryDate = babyDob ?? surgeryDate;
  const pog = parsePog(cell(row, "POG"));
  const gravida = firstNumber(cell(row, "GRAVIDA"));
  const parity = firstNumber(cell(row, "PARITY"));
  if (!sourceId || !age || !deliveryDate || !pog || gravida === null || parity === null) {
    return err(`ID ${row["ID NO"] || "?"}: skipped — needs AGE, a delivery date, POG, GRAVIDA and PARITY`);
  }

  const notes: string[] = [];
  if (babyDob && surgeryDate && babyDob !== surgeryDate) {
    notes.push(`delivery date taken from the baby's DOB (${babyDob}); DOS column says ${surgeryDate}`);
  }

  const identity = syntheticIdentity(sourceId);
  const lmp = addDays(deliveryDate, -(pog.weeks * 7 + pog.days));
  const abortions = firstNumber(cell(row, "ABORTIONS")) ?? Math.max(0, gravida - 1 - parity);
  const recordedRobson = parseRobson(cell(row, "ROBSON"));
  const complicationTokens = tokens(cell(row, "PREGNANCY COMPLICATIONS"));
  const csIndicationTokens = tokens(cell(row, "INDCATIONS OF CESAREAN"));
  const operativeFindings = (cell(row, "OPERATIVE FINDINGS") ?? "").toUpperCase();
  const secondBabySex = cell(row, "SEX OF BABY 2");
  const secondBabyWeight = cell(row, "WEIGHT 2");
  const isTwin = Boolean(secondBabySex || secondBabyWeight);
  const thyroidColumn = cell(row, "HYPOTHYROID/SCH");
  const dmGdmColumn = cell(row, "DM/GDM");
  const knownDiabetic = isYes(dmGdmColumn) && /^DM$/i.test(cell(row, "GTT/DIPSI") ?? "");

  // ---- Previous CS: the register's Robson group (the clinician's own classification) wins over a contradicting count ----
  let previousCsCount = firstNumber(cell(row, "NO OF CS")) ?? 0;
  if (previousCsCount > parity) {
    notes.push(`NO OF CS (${previousCsCount}) exceeds parity (${parity}), likely counting non-delivery uterine surgery; capped at ${parity}`);
    previousCsCount = parity;
  }
  if (recordedRobson && recordedRobson.group <= 4 && previousCsCount > 0) {
    notes.push(`register's Robson group ${recordedRobson.group} rules out a previous CS, but NO OF CS is ${previousCsCount}; used 0`);
    previousCsCount = 0;
  }
  if (recordedRobson?.group === 5 && previousCsCount === 0) {
    notes.push("register's Robson group 5 requires a previous CS, but NO OF CS is 0; used 1");
    previousCsCount = 1;
  }

  // ---- Personal ----
  const personal = compact({
    fullName: identity.fullName,
    surname: identity.surname,
    name: identity.name,
    mrn: identity.mrn,
    // The register only has age; a DOB half a year before that birthday reproduces it exactly at delivery.
    dob: addDays(addYears(deliveryDate, -age), -182),
    lmp,
    edd: addDays(lmp, 280),
    district: cell(row, "District"),
  });

  // ---- History ----
  const pregnancyComplications = new Set<string>();
  const complicationOthers: string[] = [];
  const surgeryOthers: string[] = [];
  let hypothyroidInText = false;
  for (const token of complicationTokens) {
    const matched = PREGNANCY_COMPLICATION_RULES.filter(([pattern]) => pattern.test(token)).map(([, option]) => option);
    matched.forEach((option) => pregnancyComplications.add(option));
    if (OTHER_SURGERY_PATTERN.test(token)) surgeryOthers.push(token);
    else if (HYPOTHYROID_PATTERN.test(token)) hypothyroidInText = true;
    else if (matched.length === 0 && !CS_HISTORY_PATTERN.test(token)) complicationOthers.push(token);
  }
  // CS indications sometimes name a condition the complications column left out (e.g. "CHOLESTASIS,CPD").
  for (const token of csIndicationTokens) {
    for (const [pattern, option] of PREGNANCY_COMPLICATION_RULES) if (pattern.test(token)) pregnancyComplications.add(option);
  }
  if (isYes(dmGdmColumn) && !knownDiabetic) pregnancyComplications.add("GDM");
  if (/^PIH$/i.test(cell(row, "CHR HTN") ?? "")) pregnancyComplications.add("PIH");

  const medicalHistory = new Set<string>();
  if (isYes(thyroidColumn) || /^SCH$/i.test(thyroidColumn ?? "") || hypothyroidInText) medicalHistory.add("Thyroid disorder");
  if (isYes(cell(row, "BA"))) medicalHistory.add("Bronchial Asthma");
  if (isYes(cell(row, "CHR HTN"))) medicalHistory.add("Hypertension");
  if (knownDiabetic) medicalHistory.add("Diabetes");
  const otherMedical = cell(row, "MEDICAL COMPLICATIONS");
  // Blank medical columns mean "not recorded" (left unset), not "none" (an empty list).
  const medicalRecorded = MEDICAL_COLUMNS.some((column) => (row[column] ?? "").trim() !== "") || medicalHistory.size > 0;

  const anyIvf = [...complicationTokens, ...csIndicationTokens].some((t) => /\bIVF\b/.test(t));

  const history = compact({
    // TPAL needs preterm and living counts the register doesn't have, so every birth is taken as term and living.
    obstetricIndex: `G${gravida}P${parity}0${abortions}${parity}`,
    conceptionType: anyIvf ? "IVF" : undefined,
    noCesareanDelivery: String(previousCsCount),
    noVaginalDelivery: String(Math.max(0, parity - previousCsCount)),
    lastChildbirth: gravida === 1 ? "N/A - first pregnancy" : undefined,
    // The register's ABORTIONS column doesn't separate spontaneous from MTP.
    noSponAbortions: String(abortions),
    medicalHistory: medicalRecorded ? [...medicalHistory] : undefined,
    medicalHistoryOthers: otherMedical && !isYes(otherMedical) && !isNo(otherMedical) ? otherMedical : undefined,
    surgicalHistory: previousCsCount > 0 ? ["Caesarean"] : [],
    surgicalHistoryOthers: surgeryOthers.join(", "),
    pregnancyComplications: [...pregnancyComplications],
    pregnancyComplicationsOthers: complicationOthers.join(", "),
    obstetricHistory: [],
  });

  // ---- Investigation ----
  const tshReadings = ["TSH 1", "TSH 2", "TSH 3"].map((column) => firstNumber(cell(row, column)));
  const ogttRaw = cell(row, "GTT 75 GM");
  // "81/128/106" is a 75 g OGTT read as fasting/1 h/2 h; "X" marks a missed draw.
  const ogtt = ogttRaw?.split("/").map((v) => firstNumber(v));
  if (ogttRaw && ogtt?.length !== 3) notes.push(`GTT 75 GM "${ogttRaw}" isn't a fasting/1 h/2 h triple; not imported`);
  const bloodGroupRaw = cell(row, "BLOOG GROUP");
  const bloodGroup = normalizeBloodGroup(bloodGroupRaw);
  if (bloodGroupRaw && !bloodGroup) notes.push(`blood group "${bloodGroupRaw}" not recognised; not imported`);

  const investigation = compact({
    bloodGroup,
    tsh__level: tshReadings[0] !== null ? String(tshReadings[0]) : undefined,
    doubleMarkerQuad__level: screeningResult(row, "QUADRUPLE TEST") ?? screeningResult(row, "DOUBLE MARKER"),
    niptOrAmnio__level: screeningResult(row, "NIPT"),
    randomBloodSugar: firstNumber(cell(row, "RBS")),
    gttDipsi: firstNumber(cell(row, "GTT/DIPSI")),
    fastingBloodSugar: ogtt?.length === 3 ? ogtt[0] : undefined,
    gtt75_1hr: ogtt?.length === 3 ? ogtt[1] : undefined,
    gtt75_2hr: ogtt?.length === 3 ? ogtt[2] : undefined,
  });

  // ---- Ultrasound ----
  const ultrasoundRaw: Record<string, unknown> = { ntMm: firstNumber(cell(row, "NT SCAN")) };
  const anomalyScan = cell(row, "ANOMALY SCAN");
  if (anomalyScan) {
    // A scan that was done and doesn't mention a marker is read as that marker's normal finding.
    for (const marker of SOFT_MARKERS) ultrasoundRaw[`${marker.row}__presence`] = marker.normal;
    const leftovers: string[] = [];
    for (const token of tokens(anomalyScan)) {
      const marker = SOFT_MARKERS.find((m) => m.pattern.test(token));
      const afi = token.match(/AFI(?:\/LIQUOR)?\s*=\s*(\d+(?:\.\d+)?)/);
      const placenta = token.match(/^PLACENTA\s*=\s*(.+)$/);
      const placentaLocation = placenta && PLACENTA_LOCATIONS.find(([pattern]) => pattern.test(placenta[1]))?.[1];
      if (token === "NORMAL") continue;
      if (marker) {
        ultrasoundRaw[`${marker.row}__presence`] = marker.normal === "Positive" ? "Negative" : "Positive";
        const size = token.match(/=\s*(\d+(?:\.\d+)?)/);
        if (size) ultrasoundRaw[`${marker.row}__sizeLocation`] = `${size[1]} mm`;
      } else if (afi) {
        ultrasoundRaw.afi1 = Number(afi[1]);
      } else if (placentaLocation) {
        ultrasoundRaw.placenta1 = placentaLocation;
      } else {
        leftovers.push(token);
      }
    }
    if (leftovers.length > 0) ultrasoundRaw.abnormalRemarks = `Anomaly scan: ${leftovers.join(", ")}`;
  }
  const efws = (cell(row, "LAST USG")?.match(/\d+/g) ?? []).map(Number);
  ultrasoundRaw.efwGms = efws[0];
  if (efws.length > 1) ultrasoundRaw.growthRemarks = `Twins: EFW ${efws.join(" g and ")} g`;
  const ultrasound = compact(ultrasoundRaw);

  // ---- Robson ----
  const spontaneous = isYes(cell(row, "SPON LABOUR"));
  const induced = isYes(cell(row, "INDUCED")) || csIndicationTokens.some((t) => /INDUCTION/.test(t));
  const subgroup = recordedRobson && [2, 4].includes(recordedRobson.group) ? recordedRobson.subgroup : null;
  // Neither spontaneous nor induced, in a CS register, means the CS happened before labour.
  const onsetOfLabour =
    subgroup === "A" ? "Induced" : subgroup === "B" ? "Pre-labour CS" : spontaneous ? "Spontaneous" : induced ? "Induced" : "Pre-labour CS";

  const robson: RobsonDeterminants = {
    parity: parity === 0 ? "Nullipara" : "Multipara",
    previousCs: previousCsCount === 0 ? "None" : previousCsCount === 1 ? "One Previous CS" : "Two or more Previous CS",
    numberOfFetuses: isTwin ? "Multiple" : "Singleton",
    // No presentation column; every group this register records (1-5, 8) is cephalic or a multiple pregnancy.
    fetalPresentation: "Cephalic",
    gestationalAge: pog.weeks >= 37 ? TERM : PRETERM,
    onsetOfLabour,
  };
  if (recordedRobson) {
    for (const [key, value] of Object.entries(ROBSON_GROUP_IMPLIES[recordedRobson.group] ?? {}) as [keyof RobsonDeterminants, string][]) {
      if (robson[key] === value) continue;
      notes.push(`Robson ${key}: columns give "${robson[key]}", register's group ${recordedRobson.group} implies "${value}"; used the latter`);
      robson[key] = value;
    }
    const computed = computeRobsonGroup(robson);
    if (computed !== recordedRobson.group) notes.push(`computed Robson group ${computed} differs from the register's ${recordedRobson.group}`);
  } else {
    notes.push(`no Robson group in the register; computed ${computeRobsonGroup(robson)} assuming cephalic presentation`);
  }

  // ---- Delivery ----
  const isCaesarean = csIndicationTokens.length > 0 || operativeFindings !== "";
  if (!isCaesarean) notes.push("no CS indication or operative findings; delivery mode left blank");
  const indicationsOfCs = new Set<string>();
  const unmappedCsIndications: string[] = [];
  for (const token of csIndicationTokens) {
    const options = CS_INDICATION_RULES.filter(([pattern]) => pattern.test(token)).map(([, option]) => option);
    options.forEach((option) => indicationsOfCs.add(option));
    if (options.length === 0) unmappedCsIndications.push(token);
  }
  if (isTwin) {
    notes.push(`second twin (${secondBabySex ?? "sex not recorded"}, ${secondBabyWeight ?? "?"} kg) has no field on the Delivery tab`);
  }
  const elective = cell(row, "ELECTIVE");
  const sex = cell(row, "SEX OF BABY 1")?.toUpperCase();
  const cmf = cell(row, "CMF");

  const delivery = compact({
    // ELECTIVE/EMERGENCY describe the CS's urgency, the closest the register gets to the admission type.
    admissionType: isYes(cell(row, "EMERGENCY")) || isNo(elective) ? "Emergency" : isYes(elective) ? "Routine" : undefined,
    garvidaNo: gravida >= 6 ? "G6+" : `G${gravida}`,
    dateOfDelivery: deliveryDate,
    pogOnDeliveryWeeks: Math.round((pog.weeks + pog.days / 7) * 10) / 10,
    labourType:
      onsetOfLabour === "Spontaneous" ? "Spontaneous" : onsetOfLabour === "Induced" ? "Induced" : isYes(elective) ? "Elective CS" : undefined,
    deliveryMode: isCaesarean ? "Caesarean" : undefined,
    noOfBabies: isTwin ? "2" : "1",
    indicationsOfCs: isCaesarean ? [...indicationsOfCs] : undefined,
    timeOfDelivery: parseRegisterTime(cell(row, "TOB")),
    babyWeightKg: firstNumber(cell(row, "WEIGHT 1")),
    sexOfBaby: sex === "MALE" ? "Male" : sex === "FEMALE" ? "Female" : undefined,
    apgarScore: firstNumber(cell(row, "AS")),
    cmf: isNo(cmf) ? "None" : cmf,
    postPartumComplications: PPH_PATTERN.test(operativeFindings) ? "PPH" : undefined,
  });

  // ---- Treatments ----
  const measurements = tshReadings.flatMap((tsh, i) => {
    const date = addDays(lmp, TSH_READING_WEEKS[i] * 7);
    return tsh === null || date > deliveryDate ? [] : [{ date, pogWeeks: TSH_READING_WEEKS[i], tsh }];
  });
  const courses = ["THYRONORM 1", "THYRONORM 2"]
    .map((column) => firstNumber(cell(row, column)))
    .filter((mcg): mcg is number => mcg !== null)
    .map((mcg) => ({
      condition: /^SCH$/i.test(thyroidColumn ?? "") ? "Subclinical hypothyroidism" : "Hypothyroidism",
      drug: `Thyronorm (levothyroxine) ${mcg} mcg`,
      dosage: 1,
      unit: "tablet",
      frequency: 1,
      perDays: "day",
    }));

  const tabs: Partial<Record<TabKey, TabData>> = {
    personal: finalizeTab("personal", personal, notes),
    history: finalizeTab("history", history, notes),
    delivery: finalizeTab("delivery", delivery, notes),
    robson: finalizeTab("robson", { ...robson }, notes),
  };
  if (Object.keys(investigation).length > 0) tabs.investigation = finalizeTab("investigation", investigation, notes);
  if (Object.keys(ultrasound).length > 0) tabs.ultrasound = finalizeTab("ultrasound", ultrasound, notes);
  if (measurements.length > 0 || courses.length > 0) tabs.treatments = finalizeTab("treatments", { measurements, courses }, notes);

  return ok({ sourceId, identity, tabs, unmappedCsIndications, notes });
}

/** Maps a whole register export; rows that can't become a patient are returned as reasons, never dropped silently. */
export function mapRegister(csvText: string): { patients: MappedPatient[]; skipped: string[] } {
  const patients: MappedPatient[] = [];
  const skipped: string[] = [];
  for (const row of parseCsv(csvText)) {
    const result = mapRegisterRow(row);
    if (result.ok) patients.push(result.value);
    else skipped.push(result.error);
  }
  return { patients, skipped };
}
