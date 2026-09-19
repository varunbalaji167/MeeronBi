import { prisma } from "@/server/db/prisma";

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
  return prisma.facility.findFirst({ orderBy: { createdAt: "asc" } });
}
