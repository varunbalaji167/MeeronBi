/**
 * Manual QA only — NOT run automatically by `npm run seed`. Adds 10 COMPLETE
 * patients (5 per facility) spanning Robson groups 1–10 and a mix of
 * delivery modes/complications, so the Analytics feature and the
 * super-admin facility filter/column (analytics-plan/step-03) have real,
 * varied cross-facility data to test against instead of the single demo
 * patient from prisma/seed.ts.
 *
 * Usage:
 *   npx tsx prisma/seed-analytics-demo.ts
 *
 * Prerequisite: npm run seed (creates the "default" facility + its admin).
 * Safe to run multiple times — skips any patient whose MRD already exists.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
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
  district: string;
  bloodGroup: string;
  complications: string[];
  // Robson determinants — one spec per group 1–10.
  parity: string;
  previousCs: string;
  numberOfFetuses: string;
  fetalPresentation: string;
  gestationalAge: string;
  onsetOfLabour: string;
  robsonGroup: number;
  deliveryMode: string;
  babyWeightKg: number;
  sexOfBaby: string;
  apgarScore: number;
  gestWeeksAtDelivery: number;
}

// Facility A ("default"): Robson groups 1–5. Facility B (second-facility-qa): groups 6–10.
const FACILITY_A_PATIENTS: PatientSpec[] = [
  {
    mrn: "ANLY-A-01", fullName: "Laishram Ranjita Devi", surname: "Devi", name: "Ranjita", phone: "9863011001",
    ageYears: 24, district: "Imphal West", bloodGroup: "O+", complications: [],
    parity: "Nullipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Spontaneous", robsonGroup: 1,
    deliveryMode: "Vaginal", babyWeightKg: 3.0, sexOfBaby: "Female", apgarScore: 9, gestWeeksAtDelivery: 39,
  },
  {
    mrn: "ANLY-A-02", fullName: "Thokchom Sanjenbam Chanu", surname: "Chanu", name: "Sanjenbam", phone: "9863011002",
    ageYears: 27, district: "Bishnupur", bloodGroup: "A+", complications: ["GDM"],
    parity: "Nullipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Induced", robsonGroup: 2,
    deliveryMode: "Cesarean", babyWeightKg: 3.4, sexOfBaby: "Male", apgarScore: 8, gestWeeksAtDelivery: 40,
  },
  {
    mrn: "ANLY-A-03", fullName: "Khumanthem Ibetombi Devi", surname: "Devi", name: "Ibetombi", phone: "9863011003",
    ageYears: 30, district: "Thoubal", bloodGroup: "B+", complications: [],
    parity: "Multipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Spontaneous", robsonGroup: 3,
    deliveryMode: "Vaginal", babyWeightKg: 3.1, sexOfBaby: "Male", apgarScore: 9, gestWeeksAtDelivery: 39,
  },
  {
    mrn: "ANLY-A-04", fullName: "Naorem Bijeta Devi", surname: "Devi", name: "Bijeta", phone: "9863011004",
    ageYears: 33, district: "Imphal East", bloodGroup: "AB+", complications: ["PIH"],
    parity: "Multipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Induced", robsonGroup: 4,
    deliveryMode: "Cesarean", babyWeightKg: 3.3, sexOfBaby: "Female", apgarScore: 8, gestWeeksAtDelivery: 38,
  },
  {
    mrn: "ANLY-A-05", fullName: "Yumnam Momon Devi", surname: "Devi", name: "Momon", phone: "9863011005",
    ageYears: 29, district: "Churachandpur", bloodGroup: "O-", complications: ["Anemia"],
    parity: "Multipara", previousCs: "One Previous CS", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Pre-labour CS", robsonGroup: 5,
    deliveryMode: "Cesarean", babyWeightKg: 3.2, sexOfBaby: "Male", apgarScore: 9, gestWeeksAtDelivery: 38,
  },
];

const FACILITY_B_PATIENTS: PatientSpec[] = [
  {
    mrn: "ANLY-B-01", fullName: "Chongtham Ranjita Chanu", surname: "Chanu", name: "Ranjita", phone: "9863012006",
    ageYears: 22, district: "Kangpokpi", bloodGroup: "B-", complications: [],
    parity: "Nullipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Breech",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Spontaneous", robsonGroup: 6,
    deliveryMode: "Cesarean", babyWeightKg: 2.9, sexOfBaby: "Female", apgarScore: 8, gestWeeksAtDelivery: 39,
  },
  {
    mrn: "ANLY-B-02", fullName: "Moirangthem Sunita Devi", surname: "Devi", name: "Sunita", phone: "9863012007",
    ageYears: 31, district: "Ukhrul", bloodGroup: "A-", complications: ["GDM", "Thyroid disorder"],
    parity: "Multipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Breech",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Spontaneous", robsonGroup: 7,
    deliveryMode: "Cesarean", babyWeightKg: 3.0, sexOfBaby: "Male", apgarScore: 9, gestWeeksAtDelivery: 38,
  },
  {
    mrn: "ANLY-B-03", fullName: "Salam Ningol Devi", surname: "Devi", name: "Ningol", phone: "9863012008",
    ageYears: 28, district: "Senapati", bloodGroup: "AB-", complications: [],
    parity: "Multipara", previousCs: "None", numberOfFetuses: "Multiple", fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Spontaneous", robsonGroup: 8,
    deliveryMode: "Cesarean", babyWeightKg: 2.5, sexOfBaby: "Male", apgarScore: 8, gestWeeksAtDelivery: 37,
  },
  {
    mrn: "ANLY-B-04", fullName: "Oinam Priyalata Devi", surname: "Devi", name: "Priyalata", phone: "9863012009",
    ageYears: 26, district: "Tamenglong", bloodGroup: "O+", complications: ["PIH"],
    parity: "Nullipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Transverse or Oblique lie",
    gestationalAge: "Term: 37 weeks or more", onsetOfLabour: "Pre-labour CS", robsonGroup: 9,
    deliveryMode: "Cesarean", babyWeightKg: 3.1, sexOfBaby: "Female", apgarScore: 7, gestWeeksAtDelivery: 38,
  },
  {
    mrn: "ANLY-B-05", fullName: "Konsam Iboyaima Devi", surname: "Devi", name: "Iboyaima", phone: "9863012010",
    ageYears: 21, district: "Chandel", bloodGroup: "A+", complications: [],
    parity: "Nullipara", previousCs: "None", numberOfFetuses: "Singleton", fetalPresentation: "Cephalic",
    gestationalAge: "Preterm: Less than 37 weeks", onsetOfLabour: "Spontaneous", robsonGroup: 10,
    deliveryMode: "Vaginal", babyWeightKg: 2.2, sexOfBaby: "Male", apgarScore: 7, gestWeeksAtDelivery: 34,
  },
];

async function createAnalyticsPatient(createdById: string, facilityId: string, spec: PatientSpec) {
  const existing = await prisma.patient.findUnique({ where: { facilityId_mrn: { facilityId, mrn: spec.mrn } } });
  if (existing) {
    console.log(`Patient (MRD ${spec.mrn}) already exists — skipping.`);
    return;
  }

  const now = new Date();
  const deliveryDate = addDays(now, -30);
  const lmp = addDays(deliveryDate, -7 * spec.gestWeeksAtDelivery);
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
    heightCm: 155,
    weightFirstVisitKg: 52,
    weightLastVisitKg: 62,
    profession: "Homemaker",
    highestEducation: "Secondary",
    district: spec.district,
    cityTown: spec.district,
    pin: "795001",
  };

  const historyData = {
    obstetricIndex: spec.parity === "Nullipara" ? "G1P0000" : "G2P1001",
    infertilityType: "None",
    conceptionType: "Spontaneous",
    oicMethod: [],
    noOfBoys: spec.parity === "Nullipara" ? "0" : "1",
    noOfGirls: "0",
    noCesareanDelivery: spec.previousCs === "None" ? "0" : "1",
    noVaginalDelivery: spec.parity === "Nullipara" ? "0" : "1",
    noSponAbortions: "0",
    noMtp: "0",
    medicalHistory: spec.complications.includes("Thyroid disorder") ? ["Thyroid disorder"] : [],
    surgicalHistory: [],
    pregnancyComplications: spec.complications,
  };

  const investigationData = {
    bloodGroup: spec.bloodGroup,
    indCoombsTest: "Negative",
    haemoglobin: spec.complications.includes("Anemia") ? 9.2 : 11.5,
    tsh__level: spec.complications.includes("Thyroid disorder") ? "5.8" : "2.0",
    vdrl__result: "Negative",
    hbsAg__result: "Negative",
    hiv__result: "Negative",
    randomBloodSugar: spec.complications.includes("GDM") ? "160" : "102",
    fastingBloodSugar: spec.complications.includes("GDM") ? 105 : 82,
  };

  const ultrasoundData = {
    anomalyScanDate: fmtDate(addDays(lmp, 140)),
    liePosition: spec.fetalPresentation,
    placenta2: "Posterior",
    efwGms: Math.round(spec.babyWeightKg * 1000 * 0.95),
    dopplerDone: "Yes",
    umbilicalArtery__normalAbnormal: "Normal",
  };

  const deliveryData = {
    admissionType: spec.deliveryMode === "Cesarean" ? "Emergency" : "Elective",
    medicoLegalCase: "Non-MLC",
    garvidaNo: spec.parity === "Nullipara" ? "G1" : "G2",
    dateOfDelivery: fmtDate(deliveryDate),
    pogOnDeliveryWeeks: spec.gestWeeksAtDelivery,
    labourType: spec.onsetOfLabour === "Spontaneous" ? "Spontaneous" : "Induced",
    deliveryMode: spec.deliveryMode,
    indicationsOfCs: spec.deliveryMode === "Cesarean" ? [spec.complications[0] || "Fetal distress"] : [],
    noOfBabies: spec.numberOfFetuses === "Multiple" ? "2" : "1",
    babyWeightKg: spec.babyWeightKg,
    sexOfBaby: spec.sexOfBaby,
    apgarScore: spec.apgarScore,
    nicuAdmission: spec.apgarScore <= 7 ? "Yes" : "No",
    neonatalComplications: spec.apgarScore <= 7 ? "Observed for respiratory distress" : "None",
    labourComplications: spec.complications.includes("PIH") ? "Pregnancy-induced hypertension" : "None",
    postPartumComplications: "None",
  };

  const robsonData = {
    parity: spec.parity,
    previousCs: spec.previousCs,
    numberOfFetuses: spec.numberOfFetuses,
    fetalPresentation: spec.fetalPresentation,
    gestationalAge: spec.gestationalAge,
    onsetOfLabour: spec.onsetOfLabour,
  };

  const treatmentsData = {
    measurements: [
      { date: fmtDate(addDays(lmp, 84)), pogWeeks: "12", weightKg: 54, bmi: 22.5, bpHigh: 112, bpLow: 72 },
      { date: fmtDate(addDays(lmp, 196)), pogWeeks: "28", weightKg: 60, bmi: 24.5, bpHigh: spec.complications.includes("PIH") ? 148 : 116, bpLow: spec.complications.includes("PIH") ? 96 : 76 },
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
      history: { create: { data: historyData, status: "COMPLETE" } },
      investigation: { create: { data: investigationData, status: "COMPLETE" } },
      ultrasound: { create: { data: ultrasoundData, status: "COMPLETE" } },
      delivery: {
        create: {
          data: deliveryData,
          status: "COMPLETE",
          admissionType: deliveryData.admissionType,
          deliveryMode: deliveryData.deliveryMode,
          babyWeightKg: deliveryData.babyWeightKg,
        },
      },
      robson: { create: { data: robsonData, status: "COMPLETE", groupNumber: spec.robsonGroup } },
      treatments: { create: { data: treatmentsData, status: "COMPLETE" } },
    },
  });

  console.log(`Created "${spec.fullName}" (MRD ${spec.mrn}, Robson group ${spec.robsonGroup}, ${spec.deliveryMode}) — /admin/patients/${patient.id}/personal`);
}

async function getOrCreateFacilityAdmin(facilityId: string, email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const admin = await prisma.user.create({ data: { email, passwordHash, name, role: "ADMIN", facilityId } });
  console.log(`Created admin ${email} (password: ChangeMe123!) for facility ${facilityId}.`);
  return admin;
}

async function main() {
  const facilityA = await prisma.facility.findUnique({ where: { slug: "default" } });
  if (!facilityA) {
    throw new Error('Facility "default" not found — run `npm run seed` first.');
  }
  const adminA = await getOrCreateFacilityAdmin(facilityA.id, "admin@meeronbi.org", "System Admin");

  let facilityB = await prisma.facility.findUnique({ where: { slug: "second-facility-qa" } });
  if (!facilityB) {
    facilityB = await prisma.facility.create({
      data: { slug: "second-facility-qa", name: "QA Test Hospital #2", stateCode: "DL", countryCode: "IN" },
    });
    console.log(`Created facility "${facilityB.name}" (slug: second-facility-qa).`);
  }
  const adminB = await getOrCreateFacilityAdmin(facilityB.id, "qa-admin@example.org", "QA Admin");

  for (const spec of FACILITY_A_PATIENTS) {
    await createAnalyticsPatient(adminA.id, facilityA.id, spec);
  }
  for (const spec of FACILITY_B_PATIENTS) {
    await createAnalyticsPatient(adminB.id, facilityB.id, spec);
  }

  console.log(`
Done. 5 patients in "${facilityA.name}" (default), 5 in "${facilityB.name}" (second-facility-qa),
covering Robson groups 1–10 and a mix of delivery modes / complications.

Log in as super-admin (team@meeronbi.org) to see all 10 in the patient list with the
Facility column + filter dropdown; log in as either facility's admin to see only their 5.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
