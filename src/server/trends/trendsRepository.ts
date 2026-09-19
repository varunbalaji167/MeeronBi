import { prisma } from "@/server/db/prisma";
import { getDefaultFacility } from "@/server/facilities/facilityRepository";

/**
 * Backs the public, unauthenticated /public/trends page. Every query here
 * returns counts/averages only — NEVER individual patient rows — which is
 * what makes it safe to expose without a login. If you add a new trend,
 * keep that invariant: aggregate only, no patient-identifying fields.
 *
 * Facility-scoped: there's no session here to read a facilityId from (this
 * route is deliberately unauthenticated), so this resolves "the" facility
 * via getDefaultFacility() — see that function's comment for why this is a
 * placeholder for the current single-facility deployment specifically, and
 * what changes once a second facility exists. Returns all-zero/empty trends
 * (not an error) if no facility has been seeded yet, since "nothing to show
 * yet" is a normal state for this page, not a failure.
 */
export async function getPublicTrends() {
  const facility = await getDefaultFacility();
  if (!facility) {
    return {
      totalPatients: 0,
      deliveriesByMode: [],
      robsonGroups: [],
      avgBabyWeightKg: null,
      registrationsByMonth: [],
    };
  }
  const facilityId = facility.id;

  const [totalPatients, deliveriesByMode, robsonGroups, avgBabyWeight, registrationsByMonth] =
    await Promise.all([
      prisma.patient.count({ where: { facilityId } }),
      prisma.delivery.groupBy({
        by: ["deliveryMode"],
        _count: { _all: true },
        where: { deliveryMode: { not: null }, patient: { facilityId } },
      }),
      prisma.robsonClassification.groupBy({
        by: ["groupNumber"],
        _count: { _all: true },
        where: { groupNumber: { not: null }, patient: { facilityId } },
        orderBy: { groupNumber: "asc" },
      }),
      prisma.delivery.aggregate({
        _avg: { babyWeightKg: true },
        where: { babyWeightKg: { not: null }, patient: { facilityId } },
      }),
      prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
        FROM patients
        WHERE facilityId = ${facilityId}
        GROUP BY month
        ORDER BY month ASC
        LIMIT 24
      `,
    ]);

  return {
    totalPatients,
    deliveriesByMode: deliveriesByMode.map((d: (typeof deliveriesByMode)[number]) => ({
      mode: d.deliveryMode,
      count: d._count._all,
    })),
    robsonGroups: robsonGroups.map((r: (typeof robsonGroups)[number]) => ({
      group: r.groupNumber,
      count: r._count._all,
    })),
    avgBabyWeightKg: avgBabyWeight._avg.babyWeightKg,
    registrationsByMonth: registrationsByMonth.map((r: { month: string; count: bigint }) => ({
      month: r.month,
      count: Number(r.count),
    })),
  };
}
