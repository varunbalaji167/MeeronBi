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

/** Real hospitals only, for super-admin facility pickers — excludes the administrative "hq" facility.
 * Each facility's first ADMIN is surfaced so the facilities page can offer "resend invite" for one
 * who hasn't set a password yet. */
export async function listFacilities() {
  const facilities = await prisma.facility.findMany({
    where: { slug: { not: "hq" } },
    select: {
      id: true,
      name: true,
      slug: true,
      users: {
        where: { role: "ADMIN" },
        select: { id: true, email: true, passwordHash: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return facilities.map(({ users, ...facility }) => ({
    ...facility,
    admin: users[0] ? { id: users[0].id, email: users[0].email, inviteAccepted: users[0].passwordHash !== null } : null,
  }));
}
