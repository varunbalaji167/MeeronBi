import { prisma } from "@/server/db/prisma";

/**
 * Backs the public, unauthenticated /public/trends page. Every query here
 * returns counts/averages only — NEVER individual patient rows — which is
 * what makes it safe to expose without a login. If you add a new trend,
 * keep that invariant: aggregate only, no patient-identifying fields.
 */
export async function getPublicTrends() {
  const [totalPatients, deliveriesByMode, robsonGroups, avgBabyWeight, registrationsByMonth] =
    await Promise.all([
      prisma.patient.count(),
      prisma.delivery.groupBy({
        by: ["deliveryMode"],
        _count: { _all: true },
        where: { deliveryMode: { not: null } },
      }),
      prisma.robsonClassification.groupBy({
        by: ["groupNumber"],
        _count: { _all: true },
        where: { groupNumber: { not: null } },
        orderBy: { groupNumber: "asc" },
      }),
      prisma.delivery.aggregate({
        _avg: { babyWeightKg: true },
        where: { babyWeightKg: { not: null } },
      }),
      prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
        FROM patients
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
