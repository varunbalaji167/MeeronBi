import Link from "next/link";
import { Users, Baby, Activity } from "lucide-react";
import { getPublicTrends } from "@/server/trends/trendsRepository";
import HomeLink from "./HomeLink";
import TrendsCharts from "./TrendsChartsLoader";

// Public by design: aggregate counts only, no patient rows. A 5-minute shared snapshot resists
// differencing better than per-IP rate limiting, since all traffic in the window sees the same numbers.
export const revalidate = 300;

export default async function PublicTrendsPage() {
  const trends = await getPublicTrends();
  const totalDeliveries = trends.deliveriesByMode.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-wider text-brand-600 hover:text-brand-700">
              MeeronBi
            </Link>
            <h1 className="font-display text-2xl italic text-ink">Public Research Trends</h1>
          </div>
          <HomeLink />
        </div>
      </header>

      <div className="relative">
        <div
          className="pointer-events-none absolute -top-10 right-[-8%] h-64 w-64 rounded-full bg-brand-200/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Aggregated, anonymized statistics from the antenatal care dataset. No individual
            patient data is shown here — no login required.
          </p>

          <div className="grid gap-5 sm:grid-cols-3">
            <div
              className="animate-rise-in panel flex items-center gap-4 border-l-2 border-brand-300"
              style={{ animationDelay: "0ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Registered Patients
                </h2>
                <p className="font-display text-3xl italic text-brand-700">{trends.totalPatients}</p>
              </div>
            </div>

            <div
              className="animate-rise-in panel flex items-center gap-4 border-l-2 border-gold-200"
              style={{ animationDelay: "60ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Recorded Deliveries
                </h2>
                <p className="font-display text-3xl italic text-brand-700">{totalDeliveries}</p>
              </div>
            </div>

            <div
              className="animate-rise-in panel flex items-center gap-4 border-l-2 border-brand-300"
              style={{ animationDelay: "120ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Baby className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Avg. Baby Weight
                </h2>
                <p className="font-display text-3xl italic text-brand-700">
                  {trends.avgBabyWeightKg ? `${trends.avgBabyWeightKg.toFixed(2)} kg` : "—"}
                </p>
              </div>
            </div>

            <TrendsCharts
              deliveriesByMode={trends.deliveriesByMode}
              robsonGroups={trends.robsonGroups}
              registrationsByMonth={trends.registrationsByMonth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
