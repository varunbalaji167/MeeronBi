import type { Metadata } from "next";
import Link from "next/link";
import CareTimeline from "@/components/patient/CareTimeline";
import { GrowthRings, GentleWave, LeafPattern, DotGrid } from "@/components/ui/decor";
import {
  Heart,
  BarChart3,
  FileHeart,
  Stethoscope,
  HeartHandshake,
  ArrowRight,
  Menu,
  Sparkles,
  ShieldCheck,
  Lock,
  ScrollText,
  Activity,
  Microscope,
  Baby,
  Hospital,
  Compass,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  openGraph: { title: "MeeronBi", description: "Antenatal care data collection and analytics platform", type: "website" },
};

export const dynamic = "force-static";

/* ---------- Content data ---------- */

const trustPillars: { icon: LucideIcon; label: string; body: string; accent: string }[] = [
  {
    icon: ShieldCheck,
    label: "Private to each hospital",
    body: "Every patient's record stays with the hospital that cares for them. Nothing is shared across clinics without explicit consent — ever.",
    accent: "from-brand-400 to-brand-600",
  },
  {
    icon: Lock,
    label: "Every change is traceable",
    body: "A complete history of who entered what, when — kept forever. Nothing is ever quietly overwritten or lost, so the record you trust stays the record you can trust.",
    accent: "from-brand-500 to-brand-700",
  },
  {
    icon: Microscope,
    label: "Research never identifies a patient",
    body: "Insights are always drawn from groups of patients. If a group is small enough that someone could be recognised, the number is simply not shown.",
    accent: "from-rose-400 to-brand-500",
  },
];

const capabilities: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ScrollText,
    title: "One connected record",
    body: "Seven care stages — personal history, investigations, scans, delivery, and follow-up treatment — all in one record that stays with the patient from first visit to final check.",
  },
  {
    icon: Activity,
    title: "Clinical rules that help as you type",
    body: "The Robson classification appears the moment every answer is filled. Scan sections suggest the right pregnancy week — so staff spend less time cross-checking and more time with patients.",
  },
  {
    icon: BarChart3,
    title: "Ask any question of the data",
    body: "Pick a measure and a comparison, and the right chart appears. Privacy protections sit between you and the data, so you can explore freely without worrying about identifying anyone.",
  },
  {
    icon: Hospital,
    title: "Shaped to each hospital",
    body: "Not every clinic collects the same information. Each hospital chooses which fields its staff will see — and existing patient history is never lost when the choice changes.",
  },
  {
    icon: Baby,
    title: "A home for the patient's record",
    body: "A gentle, read-only view of the same record for the patient herself — so she can see every visit, every test, every scan, exactly as her care team recorded it.",
  },
  {
    icon: HeartHandshake,
    title: "Grows with your care",
    body: "As guidelines evolve and your care team learns, the record keeps up — new questions and new fields are added without disturbing what came before.",
  },
];

const entryPoints: {
  href: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  accent: "brand" | "gold" | "rose";
}[] = [
  {
    href: "/public/trends",
    title: "View public trends",
    icon: BarChart3,
    body: "Aggregate, anonymized statistics on delivery outcomes and care patterns. No sign-in needed.",
    cta: "Explore trends",
    accent: "brand",
  },
  {
    href: "/login?role=patient",
    title: "Patients — view your record",
    icon: FileHeart,
    body: "See your own antenatal record — visits, scans, and results — exactly as your care team entered it.",
    cta: "Patient sign in",
    accent: "rose",
  },
  {
    href: "/login?role=admin",
    title: "Hospitals — add data",
    icon: Stethoscope,
    body: "Record and manage patient data across every stage of care, with drafts saved as you go.",
    cta: "Hospital sign in",
    accent: "gold",
  },
];

const stats: { value: string; label: string; sub: string }[] = [
  { value: "7", label: "Care stages per record", sub: "First visit to follow-up" },
  { value: "~137", label: "Clinical fields covered", sub: "Nothing left on paper" },
  { value: "100%", label: "Changes kept forever", sub: "Nothing silently rewritten" },
  { value: "Always", label: "Research in groups, not individuals", sub: "Privacy by design" },
];

const accentClasses: Record<string, { badge: string; border: string; cta: string; ring: string }> = {
  brand: {
    badge: "bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white",
    border: "hover:border-brand-300",
    cta: "text-brand-600",
    ring: "group-hover:ring-brand-200",
  },
  rose: {
    badge: "bg-rose-50 text-rose-500 group-hover:bg-rose-400 group-hover:text-white",
    border: "hover:border-rose-200",
    cta: "text-rose-500",
    ring: "group-hover:ring-rose-100",
  },
  gold: {
    badge: "bg-gold-50 text-gold-600 group-hover:bg-gold-500 group-hover:text-white",
    border: "hover:border-gold-200",
    cta: "text-gold-600",
    ring: "group-hover:ring-gold-100",
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-paper">
      {/* ============ Announcement bar ============ */}
      <div className="relative overflow-hidden border-b border-brand-100 bg-gradient-to-r from-brand-50 via-brand-100/60 to-brand-50">
        <GentleWave className="absolute inset-0 h-full w-full text-brand-400/30" />
        <div className="relative mx-auto flex max-w-5xl items-center justify-center gap-2 px-6 py-2 text-center text-[12.5px] font-medium text-brand-700">
          <Sparkles className="h-3.5 w-3.5 shrink-0 animate-glow" />
          <span>
            Built on WHO guidance for antenatal care &middot; aligned with the Robson Ten-Group Classification
          </span>
        </div>
      </div>

      {/* ============ Header ============ */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20">
              <Heart className="h-4 w-4 animate-beat" fill="currentColor" />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30" />
            </span>
            <span className="font-display text-lg italic text-ink transition-colors group-hover:text-brand-700">
              MeeronBi
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-soft sm:flex">
            <a href="#mission" className="transition-colors hover:text-brand-600">Mission</a>
            <a href="#capabilities" className="transition-colors hover:text-brand-600">Capabilities</a>
            <Link href="/public/trends" className="transition-colors hover:text-brand-600">Trends</Link>
            <Link href="/login?role=patient" className="transition-colors hover:text-brand-600">Patient sign in</Link>
            <Link href="/login?role=admin" className="btn-primary !px-3 !py-1.5">Hospital sign in</Link>
          </nav>

          <details className="relative sm:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-white hover:text-ink [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="animate-pop-in absolute right-0 top-full mt-2 w-52 rounded-lg border border-line bg-white p-2 shadow-panel">
              <a href="#mission" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">Mission</a>
              <a href="#capabilities" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">Capabilities</a>
              <Link href="/public/trends" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">Trends</Link>
              <Link href="/login?role=patient" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">Patient sign in</Link>
              <Link href="/login?role=admin" className="mt-1 block rounded-md bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-600">Hospital sign in</Link>
            </div>
          </details>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-paper to-paper" />
        <DotGrid className="absolute inset-0 opacity-[0.35]" color="rgb(var(--brand-500) / 0.12)" size={28} />

        <GrowthRings
          className="pointer-events-none absolute right-[-8%] top-[-15%] h-[70%] w-[70%] opacity-50 lg:h-[80%] lg:w-[80%]"
          color="rgb(var(--brand-500) / 0.04)"
          rings={8}
        />
        <GrowthRings
          className="pointer-events-none absolute -bottom-[20%] -left-[15%] h-[50%] w-[50%] opacity-30"
          color="rgb(var(--rose-300) / 0.05)"
          rings={5}
        />

        <div className="animate-rise-in relative mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/90 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand-700 shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Antenatal Care Data Analytics
              </span>
              <h1 className="mt-5 font-display text-4xl italic leading-[1.1] text-ink sm:text-5xl lg:text-[52px]">
                From first checkup
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">to first cry.</span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-1 z-0 h-3 bg-gradient-to-r from-rose-100/80 via-rose-200/80 to-rose-100/80"
                  />
                </span>
              </h1>
              <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
                MeeronBi follows a pregnancy through every stage of antenatal care — personal
                history, investigations, scans, delivery, and follow-up treatment — in a single
                connected record that staff, patients, and researchers can each see their part of.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login?role=admin"
                  className="btn-primary group relative overflow-hidden"
                >
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  <Stethoscope className="relative h-4 w-4" />
                  <span className="relative">Hospital sign in</span>
                  <ArrowRight className="relative h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/public/trends" className="btn-secondary">
                  <BarChart3 className="h-4 w-4" /> View public trends
                </Link>
              </div>
            </div>

            {/* Right-side visualization */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Growth rings halo */}
                <div aria-hidden="true" className="absolute -inset-10 opacity-30 animate-slow-spin">
                  <GrowthRings
                    className="h-full w-full"
                    color="rgb(var(--brand-400) / 0.15)"
                    rings={4}
                  />
                </div>

                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-3.5 translate-y-3.5 rotate-[3deg] rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50 to-white shadow-sm"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[1.5deg] rounded-2xl border border-brand-100 bg-white shadow-sm"
                />

                <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-panel backdrop-blur">
                  <LeafPattern
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
                    patternId="leaf-hero-card"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                      The care journey
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                      </span>
                      Secure Records
                    </span>
                  </div>

                  <div className="mt-5">
                    <CareTimeline size="lg" />
                  </div>

                  {/* Gentle wave strip replaces ECG */}
                  <div className="relative mt-5 h-10 overflow-hidden rounded-lg bg-brand-50/60 ring-1 ring-brand-100">
                    <GentleWave className="h-full w-full text-brand-500" />
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                    Seven connected stages. Each one a tab in the patient&apos;s record — from first
                    visit through delivery and follow-up treatment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile care timeline */}
          <div className="mt-12 lg:hidden">
            <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-white/90 p-5 shadow-panel">
              <LeafPattern
                className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
                patternId="leaf-hero-card-mobile"
              />
              <p className="relative mb-4 text-xs font-medium uppercase tracking-wide text-brand-600">
                The care journey
              </p>
              <CareTimeline />
              <div className="relative mt-4 h-8 overflow-hidden rounded-lg bg-brand-50/60 ring-1 ring-brand-100">
                <GentleWave className="h-full w-full text-brand-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Trust pillars ============ */}
      <section className="relative overflow-hidden border-y border-line bg-white">
        <div className="relative mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            Built on principles that matter in healthcare
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {trustPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.label}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-white to-paper/50 p-6 transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${pillar.accent} opacity-0 blur-2xl transition-opacity group-hover:opacity-20`}
                  />
                  <span className={`relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.accent} text-white shadow-sm transition-transform group-hover:scale-110`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="relative mt-5 text-[15px] font-semibold text-ink">{pillar.label}</h3>
                  <p className="relative mt-2 text-[13.5px] leading-relaxed text-ink-soft">{pillar.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ Mission ============ */}
      <section id="mission" className="relative scroll-mt-16 overflow-hidden bg-paper">
        <DotGrid className="absolute inset-0 opacity-[0.3]" color="rgb(var(--brand-500) / 0.1)" size={24} />

        <GrowthRings
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
          color="rgb(var(--brand-700))"
          rings={6}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-600">
                <Heart className="h-3.5 w-3.5 animate-beat" fill="currentColor" /> Why this matters
              </p>
              <h2 className="mt-3 font-display text-3xl italic leading-[1.15] text-ink sm:text-4xl">
                Every year, too many pregnancies end in loss we don&apos;t fully understand.
              </h2>
            </div>
            <div>
              <p className="text-[15.5px] leading-relaxed text-ink-soft">
                Distance from a clinic, spacing between pregnancies, and the hardship of daily life
                all shape how a pregnancy ends — not just the medical care given along the way. But
                no single hospital sees enough cases to prove that. MeeronBi lets many hospitals and
                clinics keep the same kind of record, so a pattern invisible in one ward — like more
                complications in villages far from care — becomes visible, and provable, across
                thousands of pregnancies.
              </p>
              <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
                A pattern proven at that scale stops being a guess. It becomes something a
                government can act on — a road fixed, a clinic added, transport funded for women
                who need it most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Capabilities ============ */}
      <section id="capabilities" className="relative scroll-mt-16 overflow-hidden border-t border-line bg-white">
        <LeafPattern className="pointer-events-none absolute inset-0 h-full w-full opacity-60" patternId="leaf-capabilities" />
        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">What it does</p>
            <h2 className="mt-2 font-display text-3xl italic leading-[1.15] text-ink sm:text-4xl">
              Everything a care team needs, in one place.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Not a prototype dressed up as a product — a working platform built around how
              antenatal care actually flows, from the first visit through the last follow-up.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
                >
                  {/* Growth ring corner accent */}
                  <GrowthRings
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 opacity-[0.06] transition-opacity group-hover:opacity-[0.12]"
                    rings={3}
                    color="rgb(var(--brand-500))"
                  />

                  <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/40 transition-all group-hover:from-brand-500 group-hover:to-brand-700 group-hover:text-white group-hover:ring-brand-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="relative mt-5 text-[15px] font-semibold text-ink">{cap.title}</h3>
                  <p className="relative mt-2 text-[13.5px] leading-relaxed text-ink-soft">{cap.body}</p>

                  <div aria-hidden="true" className="relative mt-5 h-px w-full overflow-hidden bg-brand-100/50">
                    <div className="absolute inset-y-0 left-0 w-0 bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500 group-hover:w-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ Stats band ============ */}
      <section className="relative overflow-hidden border-y border-brand-700 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        <DotGrid className="absolute inset-0 opacity-[0.15]" color="rgba(255,255,255,0.3)" size={20} />
        <GrowthRings
          className="pointer-events-none absolute right-[-8%] top-[-30%] h-[160%] w-[50%] opacity-10"
          color="white"
          rings={6}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-16">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-100">
            <Activity className="h-3.5 w-3.5" /> By the numbers
          </div>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="group relative border-l-2 border-white/30 pl-4 transition-colors hover:border-rose-300"
              >
                <p className="font-display text-3xl italic leading-tight text-white sm:text-4xl">{s.value}</p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-brand-100/90">{s.label}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-rose-200/70">{s.sub}</p>
                <span className="mt-3 block h-0.5 w-6 bg-rose-300 opacity-0 transition-all duration-300 group-hover:w-10 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Role entry points ============ */}
      <section className="relative overflow-hidden">
        <DotGrid className="absolute inset-0 opacity-[0.25]" color="rgb(var(--brand-500) / 0.08)" size={26} />
        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Who it&apos;s for</p>
            <h2 className="mt-2 font-display text-3xl italic leading-[1.15] text-ink sm:text-4xl">
              Three views of the same record.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Hospital staff write it. Patients read their own. Researchers see only what&apos;s been
              anonymized and aggregated. Every view backed by the same source of truth.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {entryPoints.map((entry) => {
              const Icon = entry.icon;
              const accent = accentClasses[entry.accent];
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-panel transition-all hover:-translate-y-1 hover:shadow-md ${accent.border}`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand-50/0 transition-colors group-hover:to-brand-50/40"
                  />
                  <span
                    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 ring-transparent transition-all ${accent.badge} ${accent.ring} group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="relative mt-5 text-base font-semibold text-ink">{entry.title}</h3>
                  <p className="relative mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{entry.body}</p>
                  <span className={`relative mt-5 flex items-center gap-1 text-sm font-medium ${accent.cta}`}>
                    {entry.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ Final CTA band ============ */}
      <section className="relative overflow-hidden border-t border-line bg-paper">
        <DotGrid className="absolute inset-0 opacity-[0.25]" color="rgb(var(--brand-500) / 0.08)" size={24} />

        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-white via-white to-brand-50/40 p-10 shadow-panel backdrop-blur sm:p-12">
            <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-600">
                  <Compass className="h-3.5 w-3.5" /> Explore the platform
                </p>
                <h2 className="mt-2 font-display text-2xl italic leading-[1.2] text-ink sm:text-3xl">
                  See how one connected record changes antenatal care.
                </h2>
                <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
                  The public trends page is open to anyone — a window into what the record makes
                  possible, without needing an account.
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-3 lg:justify-end">
                <Link
                  href="/public/trends"
                  className="btn-primary group relative overflow-hidden"
                >
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  <BarChart3 className="relative h-4 w-4" />
                  <span className="relative">View public trends</span>
                  <ArrowRight className="relative h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/login?role=admin" className="btn-secondary">
                  <Stethoscope className="h-4 w-4" /> Hospital sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="relative overflow-hidden border-t border-line bg-white">
        <LeafPattern
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          patternId="leaf-footer"
        />
        <div className="relative mx-auto max-w-5xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="group inline-flex items-center gap-2">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20">
                  <Heart className="h-4 w-4 animate-beat" fill="currentColor" />
                </span>
                <span className="font-display text-lg italic text-ink">MeeronBi</span>
              </Link>
              <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-ink-soft">
                A connected antenatal care record — built so patterns in pregnancy loss can be
                proven at scale, and acted on.
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink">Platform</p>
              <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                <li><Link href="/public/trends" className="transition-colors hover:text-brand-600">Public trends</Link></li>
                <li><Link href="/login?role=patient" className="transition-colors hover:text-brand-600">Patient sign in</Link></li>
                <li><Link href="/login?role=admin" className="transition-colors hover:text-brand-600">Hospital sign in</Link></li>
                <li><Link href="/researcher-access" className="transition-colors hover:text-brand-600">Researcher access</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink">About</p>
              <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                <li><a href="#mission" className="transition-colors hover:text-brand-600">Why it matters</a></li>
                <li><a href="#capabilities" className="transition-colors hover:text-brand-600">Capabilities</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink">Our promises</p>
              <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brand-500" /> Private by default</li>
                <li className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand-500" /> Every change tracked</li>
                <li className="inline-flex items-center gap-1.5"><Microscope className="h-3.5 w-3.5 text-brand-500" /> Safe for research</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-[12.5px] text-ink-faint sm:flex-row sm:items-center">
            <p>&copy; {new Date().getFullYear()} MeeronBi &middot; Antenatal Care Data Analytics</p>
            <p className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 animate-beat text-rose-400" fill="currentColor" />
              Built with care for maternal health
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
