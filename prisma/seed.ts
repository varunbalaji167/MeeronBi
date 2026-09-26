import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatPhoneValue } from "@/domain/phone";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Date helpers — everything is computed relative to "today" (whenever this
// seed is actually run) so the demo patient always looks like a recently
// completed pregnancy, instead of baking in dates that go stale.
// ---------------------------------------------------------------------------
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

async function seedFacility(opts: { slug: string; name: string; stateCode?: string; countryCode?: string }) {
  const existing = await prisma.facility.findUnique({ where: { slug: opts.slug } });
  if (existing) {
    console.log(`Facility "${existing.name}" (slug: ${opts.slug}) already exists — skipping.`);
    return existing;
  }

  const facility = await prisma.facility.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      stateCode: opts.stateCode,
      countryCode: opts.countryCode ?? "IN",
    },
  });

  console.log(`Created facility "${facility.name}" (slug: ${opts.slug}).`);
  return facility;
}

async function seedSuperAdmin(facilityId: string) {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || "team@meeronbi.org";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin ${email} already exists — skipping.`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const superAdmin = await prisma.user.create({
    data: { email, passwordHash, name: "MeeronBi Team", role: "SUPER_ADMIN", facilityId },
  });

  console.log(`Created super admin user:
  email:    ${email}
  password: ${password}
Change this password after first login. This account can see every facility.`);
  return superAdmin;
}

/**
 * Three researcher accounts covering all three review states, so
 * /admin/researchers has real data to look at immediately after seeding
 * instead of an empty "no requests" screen in every tab, and so the
 * pending/approved/rejected sign-in messages (see authOptions.ts's
 * authorize()) can each actually be tried without filling out the request
 * form by hand first. Uses raw prisma calls rather than
 * requestResearcherAccess()/approveResearcher() from
 * server/researchers/researcherAccessService.ts — consistent with the rest
 * of this file's style, and avoids spinning up a second PrismaClient
 * instance (that service module imports the app's own singleton) inside a
 * short-lived seed script.
 */
async function seedResearchers(hqFacilityId: string, superAdminId: string) {
  const passwordHash = await bcrypt.hash("ResearcherDemo123!", 10);

  const researchers: {
    email: string;
    name: string;
    institution: string;
    purpose: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote?: string;
  }[] = [
    {
      email: "priya.pending@example.org",
      name: "Dr. Priya Menon",
      institution: "Regional Institute of Medical Sciences (RIMS), Imphal",
      purpose:
        "Studying whether the trimester-specific TSH reference ranges currently in use hold up against this facility's own lab's historical values, or need local recalibration.",
      status: "PENDING",
    },
    {
      email: "arjun.approved@example.org",
      name: "Dr. Arjun Iyer",
      institution: "Manipur Public Health Directorate",
      purpose:
        "Regional analysis of Robson Ten-Group Classification distribution across facilities, to identify where cesarean-reduction interventions would have the most impact.",
      status: "APPROVED",
    },
    {
      email: "rejected.request@example.org",
      name: "R. Fernandes",
      institution: "Meridian Insights Group",
      purpose: "Market research on maternal health trends in Northeast India for a client-facing report.",
      status: "REJECTED",
      reviewNote: "Not an academic or public-health research purpose — commercial market research isn't in scope for this program's data access policy.",
    },
  ];

  for (const r of researchers) {
    const existing = await prisma.user.findUnique({ where: { email: r.email } });
    if (existing) {
      console.log(`Researcher ${r.email} already exists — skipping.`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: r.email,
        passwordHash,
        name: r.name,
        role: "RESEARCHER",
        facilityId: hqFacilityId,
        researcherProfile: {
          create: {
            institution: r.institution,
            purpose: r.purpose,
            status: r.status,
            ...(r.status !== "PENDING"
              ? { reviewedAt: new Date(), reviewedById: superAdminId, reviewNote: r.reviewNote }
              : {}),
          },
        },
      },
    });
    console.log(`Created ${r.status.toLowerCase()} researcher request: ${user.email} (password: ResearcherDemo123!)`);
  }
}

async function seedAdmin(facilityId: string) {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@meeronbi.org";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { email, passwordHash, name: "System Admin", role: "ADMIN", facilityId },
  });

  console.log(`Created admin user:
  email:    ${email}
  password: ${password}
Change this password after first login.`);
  return admin;
}

async function seedDemoPatient(createdById: string, facilityId: string) {
  const DEMO_MRN = "DEMO-0001";
  const existing = await prisma.patient.findUnique({ where: { facilityId_mrn: { facilityId, mrn: DEMO_MRN } } });
  if (existing) {
    console.log(`Demo patient (MRD ${DEMO_MRN}) already exists — skipping.`);
    return;
  }

  const now = new Date();
  const deliveryDate = addDays(now, -14); // delivered two weeks ago
  const lmp = addDays(deliveryDate, -7 * 40); // 40 weeks before delivery
  const edd = addDays(lmp, 280);
  const usgEdd = addDays(edd, -2);
  const dob = addYears(now, -28);
  const dateOfWedding = addYears(deliveryDate, -3);
  const prevDeliveryDate = addYears(deliveryDate, -3);

  // ---- Personal ----
  const personalData = {
    fullName: "Meikam Tombi Meitei",
    surname: "Meitei",
    name: "Tombi",
    mrn: DEMO_MRN,
    contactNo: { countryIso: "IN", number: "9863012345" },
    dob: fmtDate(dob),
    lmp: fmtDate(lmp),
    edd: fmtDate(edd),
    usgEdd: fmtDate(usgEdd),
    heightCm: 158,
    weightFirstVisitKg: 54,
    weightLastVisitKg: 65,
    religion: "Sanamahi",
    profession: "Teacher",
    highestEducation: "Graduate",
    income: "25,000-50,000/mo",
    spouseName: "Ningthoujam Somorjit Singh",
    spouseEducation: "Graduate",
    spouseOccupation: "Bank Officer",
    spouseIncome: "50,000-1,00,000/mo",
    address: "Kongba Laishram Leikai",
    landmark: "Near Kongba Bridge",
    cityTown: "Imphal East",
    district: "Imphal East",
    pin: "795005",
  };

  // ---- History ----
  const historyData = {
    dateOfWedding: fmtDate(dateOfWedding),
    obstetricIndex: "G2P1001",
    infertilityType: "None",
    conceptionType: "Spontaneous",
    oicMethod: [],
    noOfBoys: "1",
    noOfGirls: "0",
    noCesareanDelivery: "0",
    noVaginalDelivery: "1",
    lastChildbirth: "2-5 years ago",
    noSponAbortions: "0",
    noMtp: "0",
    reasonForMtp: "N/A",
    medicalHistory: ["Thyroid disorder"],
    medicalHistoryOthers: "",
    surgicalHistory: [],
    surgicalHistoryOthers: "",
    pregnancyComplications: ["GDM"],
    pregnancyComplicationsOthers: "",
    obstetricHistory: [
      {
        conception: "Spontaneous",
        complications: "None",
        outcome: "Live birth",
        date: fmtDate(prevDeliveryDate),
        gestAgeWeeks: "39",
        management: "Vaginal",
        remarks: "Uncomplicated full-term vaginal delivery.",
        noOfBabies: "1",
        weight1Kg: 3.1,
        gender1: "Male",
      },
      {},
      {},
      {},
      {},
      {},
    ],
  };

  // ---- Investigation ----
  const investigationData = {
    bloodGroup: "B+",
    indCoombsTest: "Negative",
    titre: "N/A",
    haemoglobin: 11.2,
    tsh__level: "2.1",
    tsh__testDate: fmtDate(addDays(lmp, 84)),
    tsh__gestAgeWeeks: 12,
    doubleMarkerQuad__level: "Low risk",
    doubleMarkerQuad__testDate: fmtDate(addDays(lmp, 84)),
    doubleMarkerQuad__gestAgeWeeks: 12,
    niptOrAmnio__level: "Not done",
    tlcThousands: 8.4,
    plateletCount: "2.1 lakh",
    pbsFindings: "Normal",
    bloodIndicesPcv: 34,
    bloodIndicesMcv: 82,
    bloodIndicesMch: 27,
    bloodIndicesMchc: 32,
    tsbMgdl: 0.6,
    sgot: 22,
    sgpt: 18,
    alkalinePhosphatase: 95,
    tsp: 6.8,
    alb: 3.9,
    glo: 2.9,
    urea: 18,
    creatinine: 0.6,
    naPlus: 138,
    kPlus: 4.1,
    clPlus: 102,
    uricAcid: 3.8,
    ldh: 210,
    urineProtein24hr: 120,
    otherFindings: "No significant findings.",
    vdrl__result: "Negative",
    hcvAb__result: "Negative",
    hbsAg__result: "Negative",
    hiv__result: "Negative",
    sugarTestDate: fmtDate(addDays(lmp, 168)),
    randomBloodSugar: "108",
    fastingBloodSugar: 84,
    gttDipsi: "Normal",
    gtt75_1hr: 140,
    gtt75_2hr: 120,
    gtt75_3hr: 100,
    asd: "No",
    vsd: "No",
    mvp: "No",
    pah: "No",
    additionalRemarks: "Cardiac evaluation not indicated; patient asymptomatic throughout.",
  };

  // ---- Ultrasound ----
  const ultrasoundData = {
    ntScanDate: fmtDate(addDays(lmp, 84)),
    crlMm: 55,
    pogWeeksDays: "12.3",
    ntMm: 1.8,
    ntOtherFindings: "Normal",
    anomalyScanDate: fmtDate(addDays(lmp, 140)),
    anomalyParamWeeks: 20,
    placenta1: "Posterior",
    placentaGrade1: "I",
    afi1: 12,
    afiLevel1: "Normal",
    nft__presence: "Negative",
    nasalBone__presence: "Positive",
    nasalBone__sizeLocation: "2.8mm",
    eif__presence: "Negative",
    pelvicaliectasis__presence: "Negative",
    choroidPlexusCyst__presence: "Negative",
    echogenicBowel__presence: "Negative",
    lateralVentriclesSize__presence: "Negative",
    singleUmbilicalArtery__presence: "Negative",
    otherSoftMarkers: "No soft markers identified.",
    uterineDopplerDate: fmtDate(addDays(lmp, 168)),
    pulsatilityIndex: 0.9,
    pulsatilitySide: "Both",
    diastolicNotch: "No",
    diastolicNotchSide: "Both",
    liePosition: "Cephalic",
    placenta2: "Posterior",
    placentaGrade2: "II",
    afiLiquor: 11,
    afiLevel2: 11,
    efwGms: 3100,
    growthRemarks: "Growth appropriate for gestational age.",
    dopplerDone: "Yes",
    umbilicalArtery__normalAbnormal: "Normal",
    umbilicalArtery__ri: 0.58,
    umbilicalArtery__pi: 0.85,
    umbilicalArtery__sd: 2.1,
    middleCerebralArtery__normalAbnormal: "Normal",
    middleCerebralArtery__ri: 0.75,
    middleCerebralArtery__pi: 1.6,
    middleCerebralArtery__sd: 3.8,
    descendingAorta__normalAbnormal: "Normal",
    uterineArteryRight__normalAbnormal: "Normal",
    uterineArteryRight__pi: 0.7,
    uterineArteryLeft__normalAbnormal: "Normal",
    uterineArteryLeft__pi: 0.68,
    umbilicalVeinsVelocity: 14.2,
    umbilicalVeinsStatus: "Normal",
    infVenaCavaVelocity: 10.5,
    infVenaCavaStatus: "Normal",
    ductusVenosusVelocity: 48.3,
    ductusVenosusStatus: "Normal",
  };

  // ---- Delivery ----
  const deliveryData = {
    admissionType: "Emergency",
    medicoLegalCase: "Non-MLC",
    garvidaNo: "G2",
    dateOfDelivery: fmtDate(deliveryDate),
    pogOnDeliveryWeeks: 39,
    labourType: "Spontaneous",
    indication: "N/A",
    method: "N/A",
    timesInduced: "0",
    deliveryMode: "Vaginal",
    indicationForInstDelivery: "N/A",
    noOfBabies: "1",
    indicationsOfCs: [],
    timeOfDelivery: "14:35",
    babyWeightKg: 3.2,
    sexOfBaby: "Female",
    apgarScore: 9,
    cmf: "None",
    nicuAdmission: "No",
    neonatalComplications: "None",
    labourComplications: "None",
    postPartumComplications: "None",
    hospitalNameAddress: "Ningombam Angouton Memorial Trust Hospital, Kongba Laishram Leikai, Imphal East, Manipur",
  };

  // ---- Robson (Multipara, no previous CS, singleton, cephalic, term,
  // spontaneous onset -> classifies to Group 3) ----
  const robsonData = {
    parity: "Multipara",
    previousCs: "None",
    numberOfFetuses: "Singleton",
    fetalPresentation: "Cephalic",
    gestationalAge: "Term: 37 weeks or more",
    onsetOfLabour: "Spontaneous",
  };

  // ---- Treatments ----
  const treatmentsData = {
    measurements: [
      { date: fmtDate(addDays(lmp, 84)), pogWeeks: "12", weightKg: 55, bmi: 22.0, bpHigh: 110, bpLow: 70, tsh: 2.1, freeT4: 1.2, sugarFasting: 82, sugarPp: 110 },
      { date: fmtDate(addDays(lmp, 112)), pogWeeks: "16", weightKg: 57, bmi: 22.8, bpHigh: 112, bpLow: 72, tsh: 2.0, freeT4: 1.2, sugarFasting: 80, sugarPp: 108 },
      { date: fmtDate(addDays(lmp, 140)), pogWeeks: "20", weightKg: 58.5, bmi: 23.4, bpHigh: 110, bpLow: 70, tsh: 1.9, freeT4: 1.3, sugarFasting: 79, sugarPp: 105 },
      { date: fmtDate(addDays(lmp, 196)), pogWeeks: "28", weightKg: 60, bmi: 24.0, bpHigh: 114, bpLow: 74, tsh: 1.8, freeT4: 1.3, sugarFasting: 85, sugarPp: 118 },
      { date: fmtDate(addDays(lmp, 224)), pogWeeks: "32", weightKg: 62, bmi: 24.8, bpHigh: 116, bpLow: 76, tsh: 1.7, freeT4: 1.4, sugarFasting: 83, sugarPp: 112 },
      { date: fmtDate(addDays(lmp, 252)), pogWeeks: "36", weightKg: 63, bmi: 25.2, bpHigh: 118, bpLow: 78, tsh: 1.7, freeT4: 1.4, sugarFasting: 86, sugarPp: 120 },
    ],
    courses: [
      {
        startDate: fmtDate(addDays(lmp, 56)),
        pogWeeks: "8",
        condition: "Subclinical hypothyroidism",
        drug: "Levothyroxine",
        dosage: 25,
        unit: "mg",
        frequency: 1,
        perDays: "day",
        gapsHrs: 24,
        instructions: "Take on an empty stomach in the morning, 30 min before food.",
        courseDays: 220,
      },
    ],
  };

  const patient = await prisma.patient.create({
    data: {
      fullName: personalData.fullName,
      mrn: DEMO_MRN,
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
      robson: { create: { data: robsonData, status: "COMPLETE", groupNumber: 3 } },
      treatments: { create: { data: treatmentsData, status: "COMPLETE" } },
    },
  });

  // Give her a patient-portal login too, so you can see both sides.
  const patientEmail = process.env.SEED_DEMO_PATIENT_EMAIL || "tombi.demo@meeronbi.org";
  const patientPassword = process.env.SEED_DEMO_PATIENT_PASSWORD || "PatientDemo123!";
  const passwordHash = await bcrypt.hash(patientPassword, 10);
  await prisma.user.create({
    data: {
      email: patientEmail,
      passwordHash,
      role: "PATIENT",
      facilityId,
      patient: { connect: { id: patient.id } },
    },
  });

  console.log(`Created demo patient "${personalData.fullName}" (MRD ${DEMO_MRN}) with all 7 tabs marked Complete.
  Patient portal login:
    email:    ${patientEmail}
    password: ${patientPassword}
  View it as staff at /admin/patients/${patient.id}/personal, or sign in as the patient at /login?role=patient.`);
}

/**
 * A second, deliberately UNFINISHED patient — a brand-new record with just
 * the Personal tab started and left as a DRAFT, no other tabs touched at
 * all. Exists so the patient list has more than one row to search/paginate
 * through, and so the "Draft" status badges, incomplete-tab indicators, and
 * Mark-Complete validation are all something you can look at immediately
 * rather than only after creating a patient by hand. Also exercises the
 * `allowOther` custom-value path on `district` for real (the main demo
 * patient's district is a listed option; this one deliberately isn't).
 */
async function seedDraftPatient(createdById: string, facilityId: string) {
  const DRAFT_MRN = "DEMO-0002";
  const existing = await prisma.patient.findUnique({ where: { facilityId_mrn: { facilityId, mrn: DRAFT_MRN } } });
  if (existing) {
    console.log(`Draft demo patient (MRD ${DRAFT_MRN}) already exists — skipping.`);
    return;
  }

  const lmp = addDays(new Date(), -70); // ~10 weeks along
  const personalData = {
    fullName: "Rajkumari Ibemhal Devi",
    surname: "Devi",
    name: "Ibemhal",
    mrn: DRAFT_MRN,
    contactNo: { countryIso: "IN", number: "9856001234" },
    dob: fmtDate(addYears(new Date(), -24)),
    lmp: fmtDate(lmp),
    // District deliberately NOT one of MANIPUR_DISTRICTS — demonstrates
    // the `allowOther` escape hatch (domain/textPatterns.ts) with a
    // genuine out-of-state referral case, not just the common case.
    district: "Kohima (referred from Nagaland)",
    // Left unset on purpose: usgEdd, height/weight, religion, profession,
    // address, etc. — this is what a record looks like after the very
    // first visit, before most of the tab has been filled in.
  };

  const patient = await prisma.patient.create({
    data: {
      fullName: personalData.fullName,
      mrn: DRAFT_MRN,
      contactNo: formatPhoneValue(personalData.contactNo),
      createdById,
      facilityId,
      personal: { create: { data: personalData, status: "DRAFT" } },
    },
  });

  console.log(`Created draft demo patient "${personalData.fullName}" (MRD ${DRAFT_MRN}) — Personal tab started, everything else untouched.
  View it at /admin/patients/${patient.id}/personal.`);
}

async function main() {
  // "hq" is the administrative home for SUPER_ADMIN/RESEARCHER accounts —
  // neither role's data access is scoped by facility (see
  // server/auth/guards.ts), but every User still needs *a* facilityId
  // (kept required for everyone on purpose — see schema.prisma's comment
  // on User.facilityId). Seeded first/separately from the demo hospital so
  // cross-facility testing (prisma/seed-second-facility.ts) stays clean —
  // "hq" is never meant to hold patient data itself.
  const hq = await seedFacility({ slug: "hq", name: "MeeronBi HQ" });
  const superAdmin = await seedSuperAdmin(hq.id);
  await seedResearchers(hq.id, superAdmin.id);

  const facility = await seedFacility({
    slug: "default",
    name: "Ningombam Angouton Memorial Trust Hospital",
    stateCode: "MN", // Manipur
  });
  const admin = await seedAdmin(facility.id);
  await seedDemoPatient(admin.id, facility.id);
  await seedDraftPatient(admin.id, facility.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
