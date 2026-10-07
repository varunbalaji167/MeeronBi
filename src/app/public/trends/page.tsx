import Link from "next/link";
import {
  Users, Baby, Activity, Heart, ArrowRight, Microscope,
  ShieldCheck, BarChart3, FlaskConical, type LucideIcon,
} from "lucide-react";
import { getPublicTrends } from "@/server/trends/trendsRepository";
import { GrowthRings, GentleWave, LeafPattern, DotGrid } from "@/components/ui/decor";
import HomeLink from "./HomeLink";
import TrendsCharts from "./TrendsChartsLoader";

export const revalidate = 300;

const highlights: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BarChart3,
    title: "Measure × dimension explorer",
    body: "Full researcher access lets you pick any clinical measure and break it down by age, parity, district, or pregnancy risk — in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Disclosure-controlled",
    body: "Every result is aggregate. Groups smaller than five are automatically suppressed — no individual patient can ever be identified.",
  },
  {
    icon: FlaskConical,
    title: "Robson-ready dataset",
    body: "Deliveries are pre-classified into the WHO Robson Ten-Group system, so caesarean-rate audits and inter-facility comparisons are one click away.",
  },
];

export default async function PublicTrendsPage() {
  const trends = await getPublicTrends();
  const totalDeliveries = trends.deliveriesByMode.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20">
              <Heart className="h-4 w-4 animate-beat" fill="currentColor" />
            </span>
            <span className="font-display text-lg italic text-ink transition-colors group-hover:text-brand-700">
              MeeronBi
            </span>
          </Link>
          <HomeLink />
        </div>
      </header>

      {/* ── Hero / stats ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        <DotGrid className="absolute inset-0 opacity-[0.08]" color="rgba(255,255,255,0.4)" size={22} />
        <GrowthRings
          className="pointer-events-none absolute right-[-8%] top-[-20%] h-[70%] w-[50%] opacity-[0.06]"
          color="rgba(255,255,255,0.3)"
          rings={6}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-15">
          <GentleWave className="h-full w-full text-white" fill />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-14 sm:py-16">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-100 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live aggregate data
            </span>
            <span className="text-[11px] text-brand-300">Refreshes every 5 minutes</span>
          </div>

          <h1 className="mt-5 font-display text-3xl italic leading-[1.15] text-white sm:text-4xl">
            Public antenatal care trends
          </h1>
          <p className="mt-4 mb-10 max-w-2xl text-[15px] leading-relaxed text-brand-100">
            Aggregated, anonymized statistics from a real antenatal care dataset — delivery
            outcomes, registration growth, and clinical classifications. No individual patient
            data is ever shown. No login required.
          </p>

          <div className="grid gap-5 sm:grid-cols-3">
            <div
              className="animate-rise-in flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              style={{ animationDelay: "0ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/30 text-brand-100">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                  Registered Patients
                </h2>
                <p className="font-display text-3xl italic text-white">{trends.totalPatients}</p>
              </div>
            </div>

            <div
              className="animate-rise-in flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              style={{ animationDelay: "60ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-200">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                  Recorded Deliveries
                </h2>
                <p className="font-display text-3xl italic text-white">{totalDeliveries}</p>
              </div>
            </div>

            <div
              className="animate-rise-in flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              style={{ animationDelay: "120ms" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/30 text-brand-100">
                <Baby className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                  Avg. Baby Weight
                </h2>
                <p className="font-display text-3xl italic text-white">
                  {trends.avgBabyWeightKg ? `${trends.avgBabyWeightKg.toFixed(2)} kg` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts section ── */}
      <div className="relative overflow-hidden bg-white">
        <DotGrid className="absolute inset-0 opacity-[0.3]" color="rgb(var(--brand-500) / 0.06)" size={26} />
        <LeafPattern className="pointer-events-none absolute inset-0 h-full w-full opacity-40" patternId="leaf-trends" />
        <GrowthRings
          className="pointer-events-none absolute left-[-10%] bottom-[-20%] h-[50%] w-[50%] opacity-[0.05]"
          color="rgb(var(--brand-500) / 0.1)"
          rings={5}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            <Microscope className="mb-0.5 mr-1.5 inline-block h-3.5 w-3.5" />
            What the data shows
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            These charts are drawn from the same dataset researchers access — here in
            aggregate form, open to everyone.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <TrendsCharts
              deliveriesByMode={trends.deliveriesByMode}
              robsonGroups={trends.robsonGroups}
              registrationsByMonth={trends.registrationsByMonth}
            />
          </div>
        </div>
      </div>

      {/* ── What researchers can explore ── */}
      <section className="relative overflow-hidden border-y border-line bg-paper">
        <DotGrid className="absolute inset-0 opacity-[0.25]" color="rgb(var(--brand-500) / 0.08)" size={24} />

        <div className="relative mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            With researcher access
          </p>
          <h2 className="mt-2 font-display text-2xl italic leading-[1.2] text-ink sm:text-3xl">
            Go deeper than these charts.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            What you see above is the public summary. Approved researchers get interactive,
            dimension-by-dimension analytics — still aggregate, still privacy-safe, but far
            more powerful.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {highlights.map((h) => {
              const Icon = h.icon;
              return (
                <div
                  key={h.title}
                  className="group relative overflow-hidden rounded-xl border border-line bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                >
                  <GrowthRings
                    className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 opacity-[0.05] transition-opacity group-hover:opacity-[0.1]"
                    rings={3}
                    color="rgb(var(--brand-500))"
                  />
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/40 transition-all group-hover:from-brand-500 group-hover:to-brand-700 group-hover:text-white group-hover:ring-brand-300">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="relative mt-4 text-[14.5px] font-semibold text-ink">{h.title}</h3>
                  <p className="relative mt-1.5 text-[13px] leading-relaxed text-ink-soft">{h.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Researcher CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        <DotGrid className="absolute inset-0 opacity-[0.1]" color="rgba(255,255,255,0.3)" size={20} />
        <GrowthRings
          className="pointer-events-none absolute right-[-6%] top-[-25%] h-[140%] w-[45%] opacity-[0.06]"
          color="white"
          rings={5}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-14">
          <div className="grid gap-8 sm:grid-cols-[1.3fr_1fr] sm:items-center">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-200">
                <FlaskConical className="h-3.5 w-3.5" /> For researchers
              </p>
              <h2 className="mt-3 font-display text-2xl italic leading-[1.2] text-white sm:text-3xl">
                The real dataset is richer than this page.
              </h2>
              <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-brand-100">
                Request access to explore the full analytics suite — pick any clinical measure,
                break it down by patient demographics, and audit caesarean rates against the WHO
                Robson classification. Every result is disclosure-controlled and aggregate.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <Link
                href="/researcher-access"
                className="group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                Request researcher access
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login?role=researcher"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Already approved? Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative overflow-hidden border-t border-line bg-white">
        <LeafPattern
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          patternId="leaf-trends-footer"
        />
        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-4 text-[12.5px] text-ink-faint sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Link href="/" className="group inline-flex items-center gap-1.5">
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20">
                  <Heart className="h-3 w-3 animate-beat" fill="currentColor" />
                </span>
                <span className="font-display text-sm italic text-ink">MeeronBi</span>
              </Link>
              <span className="text-ink-faint/40">·</span>
              <span>Antenatal Care Data Analytics</span>
            </div>
            <p className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 animate-beat text-rose-400" fill="currentColor" />
              Built with care for maternal health
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
