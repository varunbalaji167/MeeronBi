/**
 * Manual QA only — NOT run automatically by `npm run seed`. Creates a
 * SECOND facility with its own admin, specifically so you can verify the
 * facility-isolation guards actually work: log in as this admin and
 * confirm you can't see or reach the default facility's demo patient
 * (visiting their /admin/patients/[id] URL directly should 404).
 *
 * Usage:
 *   npx tsx prisma/seed-second-facility.ts
 *
 * Safe to run multiple times — skips if this facility already exists.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const slug = "second-facility-qa";
  const existing = await prisma.facility.findUnique({ where: { slug } });
  if (existing) {
    console.log(`"${existing.name}" already exists (slug: ${slug}) — skipping.`);
    return;
  }

  const facility = await prisma.facility.create({
    data: { slug, name: "QA Test Hospital #2", stateCode: "DL", countryCode: "IN" },
  });

  const email = "qa-admin@example.org";
  const password = "QaAdmin123!";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash, name: "QA Admin", role: "ADMIN", facilityId: facility.id, emailVerifiedAt: new Date() },
  });

  console.log(`Created "${facility.name}" (slug: ${slug}) with admin login:
  email:    ${email}
  password: ${password}

Now: log in as this admin, confirm the patients list is empty (not the
default facility's demo patient), and confirm visiting the default
facility's demo-patient URL directly returns a 404 rather than their record.
Delete this facility (and its admin) from Prisma Studio when you're done —
it's QA-only, not meant to stick around.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
