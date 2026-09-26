import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/http/errors";

/** Resolves "the" facility for unauthenticated contexts (public trends page), preferring the seeded "default" slug. */
export async function getDefaultFacility() {
  const bySlug = await prisma.facility.findUnique({ where: { slug: "default" } });
  if (bySlug) return bySlug;
  // Excludes "hq" — the administrative home for SUPER_ADMIN/RESEARCHER, never a real hospital.
  return prisma.facility.findFirst({ where: { slug: { not: "hq" } }, orderBy: { createdAt: "asc" } });
}

/** The administrative "home" facility for SUPER_ADMIN/RESEARCHER accounts; throws rather than falling back if unseeded. */
export async function getHqFacility() {
  const facility = await prisma.facility.findUnique({ where: { slug: "hq" } });
  if (!facility) {
    throw new NotFoundError("The HQ facility hasn't been seeded yet — run `npm run seed`.");
  }
  return facility;
}

/** Real hospitals only, for super-admin facility pickers — excludes the administrative "hq" facility. */
export async function listFacilities() {
  return prisma.facility.findMany({
    where: { slug: { not: "hq" } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}
