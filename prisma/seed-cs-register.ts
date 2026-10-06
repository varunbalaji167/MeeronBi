// Seeds 60 de-identified real CS-register deliveries (prisma/cs-register/) across 3 facilities, for Analytics testing.
// Usage: `npx tsx prisma/seed-cs-register.ts [--dry-run]` after `npm run seed`; idempotent, creates no user accounts.
import fs from "fs";
import path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import { computeRobsonGroup, getTabByKey } from "@/domain/tabs";
import { getMissingRequiredFieldNames } from "@/domain/validation";
import { mapRegister, type MappedPatient, type TabData, type TabKey } from "./cs-register/mapRegisterRow";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const DEMO_FACILITIES = [
  { slug: "demo-loktak-maternity", name: "Loktak Maternity Centre (Demo)", stateCode: "MN" },
  { slug: "demo-sangai-womens-hospital", name: "Sangai Women's Hospital (Demo)", stateCode: "MN" },
];
// Half stay in "default" so its seeded admin sees real volume; the demo facilities have no admin, only super-admin/researcher access.
const FACILITY_ROTATION = ["default", "default", DEMO_FACILITIES[0].slug, DEMO_FACILITIES[1].slug];

function facilitySlugFor(index: number): string {
  return FACILITY_ROTATION[index % FACILITY_ROTATION.length];
}

function tabCreates(tabs: MappedPatient["tabs"]) {
  // Closed 2020 deliveries: COMPLETE even where the register never had a form-required field, since analytics reads COMPLETE rows only.
  const complete = (data: TabData) => ({ data: data as Prisma.InputJsonObject, status: "COMPLETE" as const });
  const { personal, history, investigation, ultrasound, delivery, robson, treatments } = tabs;
  return {
    personal: personal && { create: complete(personal) },
    history: history && { create: complete(history) },
    investigation: investigation && { create: complete(investigation) },
    ultrasound: ultrasound && { create: complete(ultrasound) },
    treatments: treatments && { create: complete(treatments) },
    // Denormalized columns mirror deriveExtraColumns in server/patients/tabRecordRepository.ts.
    delivery: delivery && {
      create: {
        ...complete(delivery),
        admissionType: (delivery.admissionType as string | undefined) ?? null,
        deliveryMode: (delivery.deliveryMode as string | undefined) ?? null,
        babyWeightKg: typeof delivery.babyWeightKg === "number" ? delivery.babyWeightKg : null,
      },
    },
    robson: robson && { create: { ...complete(robson), groupNumber: computeRobsonGroup(robson) } },
  };
}

function printMappingReport(patients: MappedPatient[], skipped: string[]) {
  console.log(`Mapped ${patients.length} register rows; skipped ${skipped.length}.`);
  skipped.forEach((reason) => console.log(`  - ${reason}`));

  console.log("\nJudgement calls made while mapping:");
  for (const patient of patients) patient.notes.forEach((n) => console.log(`  - ID ${patient.sourceId}: ${n}`));

  const missing = new Map<string, number>();
  for (const patient of patients) {
    for (const [tabKey, data] of Object.entries(patient.tabs) as [TabKey, TabData][]) {
      for (const field of getMissingRequiredFieldNames(getTabByKey(tabKey)!, data)) {
        missing.set(`${tabKey}.${field}`, (missing.get(`${tabKey}.${field}`) ?? 0) + 1);
      }
    }
  }
  console.log("\nForm-required fields the register doesn't have (tabs are still marked Complete):");
  missing.forEach((count, field) => console.log(`  - ${field}: missing in ${count}/${patients.length}`));

  const unmapped = new Map<string, number>();
  patients.flatMap((p) => p.unmappedCsIndications).forEach((t) => unmapped.set(t, (unmapped.get(t) ?? 0) + 1));
  console.log("\nCS indications with no Delivery-tab option (left out of indicationsOfCs):");
  console.log(`  ${[...unmapped].map(([t, n]) => `${t} ×${n}`).join(", ")}`);

  const perFacility = new Map<string, number>();
  patients.forEach((_, i) => perFacility.set(facilitySlugFor(i), (perFacility.get(facilitySlugFor(i)) ?? 0) + 1));
  console.log(`\nFacility split: ${[...perFacility].map(([slug, n]) => `${slug} ${n}`).join(", ")}`);
}

async function ensureFacilities(): Promise<Record<string, { id: string; name: string }>> {
  const defaultFacility = await prisma.facility.findUnique({ where: { slug: "default" } });
  if (!defaultFacility) throw new Error('Facility "default" not found — run `npm run seed` first.');

  const bySlug: Record<string, { id: string; name: string }> = { default: defaultFacility };
  for (const facility of DEMO_FACILITIES) {
    bySlug[facility.slug] = await prisma.facility.upsert({ where: { slug: facility.slug }, update: {}, create: facility });
  }
  return bySlug;
}

async function main() {
  const csv = fs.readFileSync(path.join(__dirname, "cs-register", "register-2020.csv"), "utf8");
  const { patients, skipped } = mapRegister(csv);
  printMappingReport(patients, skipped);
  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  // The demo facilities have no staff account, so every record is attributed to the super admin who can see them all.
  const creator = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!creator) throw new Error("No SUPER_ADMIN user found — run `npm run seed` first.");
  const facilities = await ensureFacilities();

  const created = new Map<string, number>();
  let alreadyPresent = 0;
  for (const [i, patient] of patients.entries()) {
    const facility = facilities[facilitySlugFor(i)];
    const { fullName, mrn } = patient.identity;
    const existing = await prisma.patient.findUnique({ where: { facilityId_mrn: { facilityId: facility.id, mrn } } });
    if (existing) {
      alreadyPresent++;
      continue;
    }
    await prisma.patient.create({
      data: { fullName, mrn, createdById: creator.id, facilityId: facility.id, ...tabCreates(patient.tabs) },
    });
    created.set(facility.name, (created.get(facility.name) ?? 0) + 1);
  }

  console.log(`\nCreated ${[...created.values()].reduce((a, b) => a + b, 0)} patients (MRDs CSR-001…), ${alreadyPresent} already present:`);
  created.forEach((count, name) => console.log(`  - ${name}: ${count}`));
  console.log(`Records are attributed to ${creator.email}. Log in as the super admin to see all facilities in Analytics.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
