import { prisma } from "@/server/db/prisma";
import { getDefaultFacility } from "@/server/facilities/facilityRepository";

/**
 * Backs the public, unauthenticated /public/trends page. Every query returns counts/averages only — never individual patient rows.
 * Resolves the facility via getDefaultFacility(); returns all-zero trends (not an error) if none is seeded yet.
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
