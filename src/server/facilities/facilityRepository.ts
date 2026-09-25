import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/http/errors";

/**
 * Resolves "the" facility for contexts that have no session to read a
 * facilityId from — today, that's only the unauthenticated public trends
 * page (see server/trends/trendsRepository.ts). Looks up the seeded
 * "default" slug first (see prisma/seed.ts), falling back to the oldest
 * facility if that slug doesn't exist for some reason, so this doesn't
 * hard-fail on an unusual seed.
 *
 * This is a deliberate placeholder for the single-facility deployment this
 * app runs as today — see docs/SCALING_PLAN.md §3's note on `/public/trends`
 * needing a real per-facility picker (a URL slug, most likely) once a
 * second facility exists. Swapping that in later means giving this
 * function a `slug` parameter pulled from the URL instead of hardcoding
 * "default" — not a redesign.
 */
export async function getDefaultFacility() {
  const bySlug = await prisma.facility.findUnique({ where: { slug: "default" } });
  if (bySlug) return bySlug;
  // Excludes "hq" explicitly — it's the administrative home for
  // SUPER_ADMIN/RESEARCHER accounts (see getHqFacility below), never a
  // real hospital with patient data, so it must never become "the"
  // facility public trends silently falls back to showing.
  return prisma.facility.findFirst({ where: { slug: { not: "hq" } }, orderBy: { createdAt: "asc" } });
}

/**
 * The administrative "home" facility for SUPER_ADMIN and RESEARCHER
 * accounts, neither of which is conceptually tied to one hospital's data
 * — see prisma/schema.prisma's User.facilityId comment for why they still
 * need *a* facilityId (kept required for everyone, rather than making the
 * column nullable) even though it isn't used to scope their access the
 * way it does for ADMIN/PATIENT. Seeded once, in prisma/seed.ts; throws
 * rather than silently falling back to some other facility if it's
 * missing, since silently anchoring a researcher to the wrong hospital's
 * facility would be a real, not cosmetic, mistake.
 */
export async function getHqFacility() {
  const facility = await prisma.facility.findUnique({ where: { slug: "hq" } });
  if (!facility) {
    throw new NotFoundError("The HQ facility hasn't been seeded yet — run `npm run seed`.");
  }
  return facility;
}
