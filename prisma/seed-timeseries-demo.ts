/**
 * Manual QA only — NOT run automatically by `npm run seed`. Adds 6 COMPLETE patients
 * whose Treatments > Measurements rows carry `tsh` + `weightKg` values across all four
 * trimester buckets (pre-pregnancy, T1, T2, T3), so the time-series Analytics feature
 * (analytics-plan/step-11, step-12) has real, multi-point data to demo:
 *
 *   - Single-patient mode: pick "TSH (mU/L)" for any one of these patients — a full
 *     4-point line against STANDARD_SEGMENTS.tsh's reference band. Two patients run a
 *     consistently elevated TSH so their line visibly clears the band.
 *   - Cohort mode: all 6 share one district ("Kakching") that no other seeded patient
 *     uses, so grouping by District is the one category with n=6 — above
 *     MIN_CELL_SIZE.internal (5) in disclosureControl.ts. Every other seeded patient
 *     (prisma/seed.ts, prisma/seed-analytics-demo.ts) has a district all their own,
 *     which suppresses every cohort-mode category — this is the one that won't.
 *
 * Usage:
 *   npx tsx prisma/seed-timeseries-demo.ts
 *
 * Prerequisite: npm run seed (creates the "default" facility + its admin).
 * Safe to run multiple times — skips any patient whose MRD already exists.
 */
import { PrismaClient } from "@prisma/client";
import { formatPhoneValue } from "@/domain/phone";

const prisma = new PrismaClient();

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function addYears(d: Date, years: number): Date {
  const copy = new Date(d);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

interface PatientSpec {
  mrn: string;
  fullName: string;
  surname: string;
  name: string;
  phone: string;
  ageYears: number;
  /** How far along "today" is — kept identical across patients so every one has live entries in all four buckets. */
  gestWeeksNow: number;
  /** Runs TSH ~2 mU/L above every STANDARD_SEGMENTS.tsh band, for a visibly-out-of-range single-patient demo. */
  thyroidDisorder: boolean;
  /** Spreads the cohort's weight values so the averaged line isn't suspiciously flat. */
  weightOffsetKg: number;
}

// A district none of the other seed scripts use — every other seeded patient has a district all
// their own, which suppresses every cohort-mode category (n=1 < MIN_CELL_SIZE.internal). All 6 here
// share this one so cohort time-series has exactly one category that clears the threshold.
const DISTRICT = "Kakching";

const PATIENTS: PatientSpec[] = [
  { mrn: "TS-DEMO-01", fullName: "Leimapokpam Ronita Devi", surname: "Devi", name: "Ronita", phone: "9863013001", ageYears: 25, gestWeeksNow: 26, thyroidDisorder: false, weightOffsetKg: 0 },
  { mrn: "TS-DEMO-02", fullName: "Ngangbam Sobita Devi", surname: "Devi", name: "Sobita", phone: "9863013002", ageYears: 28, gestWeeksNow: 26, thyroidDisorder: true, weightOffsetKg: 1.5 },
  { mrn: "TS-DEMO-03", fullName: "Wahengbam Rina Devi", surname: "Devi", name: "Rina", phone: "9863013003", ageYears: 22, gestWeeksNow: 26, thyroidDisorder: false, weightOffsetKg: -1 },
  { mrn: "TS-DEMO-04", fullName: "Yumnam Bidya Devi", surname: "Devi", name: "Bidya", phone: "9863013004", ageYears: 31, gestWeeksNow: 26, thyroidDisorder: false, weightOffsetKg: 2 },
  { mrn: "TS-DEMO-05", fullName: "Khuraijam Nanda Devi", surname: "Devi", name: "Nanda", phone: "9863013005", ageYears: 26, gestWeeksNow: 26, thyroidDisorder: true, weightOffsetKg: -0.5 },
  { mrn: "TS-DEMO-06", fullName: "Sarangthem Ibemhal Devi", surname: "Devi", name: "Ibemhal", phone: "9863013006", ageYears: 29, gestWeeksNow: 26, thyroidDisorder: false, weightOffsetKg: 0.5 },
];

async function createTimeSeriesDemoPatient(createdById: string, facilityId: string, spec: PatientSpec) {
  const existing = await prisma.patient.findUnique({ where: { facilityId_mrn: { facilityId, mrn: spec.mrn } } });
  if (existing) {
    console.log(`Patient (MRD ${spec.mrn}) already exists — skipping.`);
    return;
  }

  const now = new Date();
  const lmp = addDays(now, -7 * spec.gestWeeksNow);
  const edd = addDays(lmp, 280);
  const dob = addYears(now, -spec.ageYears);

  const personalData = {
    fullName: spec.fullName,
    surname: spec.surname,
    name: spec.name,
    mrn: spec.mrn,
    contactNo: { countryIso: "IN", number: spec.phone },
    dob: fmtDate(dob),
    lmp: fmtDate(lmp),
    edd: fmtDate(edd),
    heightCm: 156,
    weightFirstVisitKg: 50 + spec.weightOffsetKg,
    weightLastVisitKg: 60 + spec.weightOffsetKg,
    profession: "Homemaker",
    highestEducation: "Secondary",
    district: DISTRICT,
    cityTown: DISTRICT,
    pin: "795148",
  };

  // Four dated visits, one per trimester bucket (bucketTrimester in derivedFields.ts): before LMP
  // -> prePregnancy, ~10wk -> T1, ~20wk -> T2, ~30wk -> T3.
  const tshOffset = spec.thyroidDisorder ? 2.0 : 0;
  const treatmentsData = {
    measurements: [
      { date: fmtDate(addDays(lmp, -14)), pogWeeks: "0", weightKg: 48 + spec.weightOffsetKg, bmi: 20.5, bpHigh: 110, bpLow: 70, tsh: 2.0 + tshOffset },
      { date: fmtDate(addDays(lmp, 70)), pogWeeks: "10", weightKg: 52 + spec.weightOffsetKg, bmi: 21.5, bpHigh: 112, bpLow: 72, tsh: 1.8 + tshOffset },
      { date: fmtDate(addDays(lmp, 140)), pogWeeks: "20", weightKg: 57 + spec.weightOffsetKg, bmi: 23.4, bpHigh: 114, bpLow: 74, tsh: 2.4 + tshOffset },
      { date: fmtDate(addDays(lmp, 210)), pogWeeks: "30", weightKg: 62 + spec.weightOffsetKg, bmi: 25.5, bpHigh: 118, bpLow: 76, tsh: 2.7 + tshOffset },
    ],
    courses: [],
  };

  const patient = await prisma.patient.create({
    data: {
      fullName: personalData.fullName,
      mrn: spec.mrn,
      contactNo: formatPhoneValue(personalData.contactNo),
      createdById,
      facilityId,
      personal: { create: { data: personalData, status: "COMPLETE" } },
      treatments: { create: { data: treatmentsData, status: "COMPLETE" } },
    },
  });

  console.log(`Created "${spec.fullName}" (MRD ${spec.mrn}, District ${DISTRICT}) — /admin/patients/${patient.id}/personal`);
}

async function main() {
  const facility = await prisma.facility.findUnique({ where: { slug: "default" } });
  if (!facility) {
    throw new Error('Facility "default" not found — run `npm run seed` first.');
  }

  const admin = await prisma.user.findUnique({ where: { email: "admin@meeronbi.org" } });
  if (!admin) {
    throw new Error('Admin "admin@meeronbi.org" not found — run `npm run seed` first.');
  }

  for (const spec of PATIENTS) {
    await createTimeSeriesDemoPatient(admin.id, facility.id, spec);
  }

  console.log(`
Done. ${PATIENTS.length} patients in "${facility.name}" (default), all in district "${DISTRICT}",
each with 4 dated Treatments > Measurements entries (pre-pregnancy, T1, T2, T3) for both
"Weight (kg)" and "TSH (mU/L)".

Try in the Analytics workbench, Time-series mode:
  - One patient: search "TS-DEMO" or "Devi" -> field "TSH (mU/L)" -> a 4-point line
    against the reference band (patients 2 and 5 run visibly above it).
  - Cohort: field "TSH (mU/L)" -> Group by "District" -> one averaged "${DISTRICT}"
    line (n=${PATIENTS.length}, clears the disclosure threshold that suppresses every
    other seeded district).
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
