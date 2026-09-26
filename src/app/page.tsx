import Link from "next/link";
import CareTimeline from "@/components/patient/CareTimeline";
import {
  Heart,
  BarChart3,
  FileHeart,
  Stethoscope,
  Database,
  HeartHandshake,
  BookOpen,
  ArrowRight,
  Menu,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// No session or per-request data read here, so this page can be fully static.
export const dynamic = "force-static";

const team: { role: string; body: string; icon: LucideIcon }[] = [
  {
    role: "Clinical Lead",
    icon: Stethoscope,
    body: "Sets the data standards for antenatal visits, investigations, and delivery outcomes, and keeps the record aligned with WHO guidance including the Robson Ten-Group Classification.",
  },
  {
    role: "Data & Systems",
    icon: Database,
    body: "Builds and maintains the platform itself — the record-keeping, the access controls, and the research dashboards drawn from it.",
  },
  {
    role: "Community Health Coordinator",
    icon: HeartHandshake,
    body: "Works with patients and frontline hospital staff so the record reflects how care is actually delivered, not just how it's meant to look on paper.",
  },
  {
    role: "Research & Policy",
    icon: BookOpen,
    body: "Turns the anonymized, aggregate trends into insight — where care patterns are working, and where they need attention.",
  },
];

const entryPoints: {
  href: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  accent: "brand" | "gold" | "ink";
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
    accent: "gold",
  },
  {
    href: "/login?role=admin",
    title: "Hospitals — add data",
    icon: Stethoscope,
    body: "Record and manage patient data across every stage of care, with drafts saved as you go.",
    cta: "Hospital sign in",
    accent: "ink",
  },
];

const accentClasses: Record<string, { badge: string; border: string; cta: string }> = {
  brand: {
    badge: "bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white",
    border: "hover:border-brand-300",
    cta: "text-brand-600",
  },
  gold: {
    badge: "bg-gold-50 text-gold-600 group-hover:bg-gold-500 group-hover:text-white",
    border: "hover:border-gold-200",
    cta: "text-gold-600",
  },
  ink: {
    badge: "bg-paper text-ink-soft group-hover:bg-ink group-hover:text-white",
    border: "hover:border-ink/20",
    cta: "text-ink",
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg italic text-ink">
            MeeronBi
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-soft sm:flex">
            <a href="#mission" className="hover:text-brand-600">
              Mission
            </a>
            <a href="#team" className="hover:text-brand-600">
              Team
            </a>
            <Link href="/public/trends" className="hover:text-brand-600">
              Trends
            </Link>
            <Link href="/login?role=patient" className="hover:text-brand-600">
              Patient sign in
            </Link>
            <Link href="/login?role=admin" className="btn-primary !px-3 !py-1.5">
              Hospital sign in
            </Link>
          </nav>

          {/* Mobile menu — a native <details> disclosure keeps this page fully static (no client JS needed) */}
          <details className="relative sm:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-white hover:text-ink [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="animate-pop-in absolute right-0 top-full mt-2 w-52 rounded-lg border border-line bg-white p-2 shadow-panel">
              <a href="#mission" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                Mission
              </a>
              <a href="#team" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                Team
              </a>
              <Link href="/public/trends" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                Trends
              </Link>
              <Link href="/login?role=patient" className="block rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                Patient sign in
              </Link>
              <Link href="/login?role=admin" className="mt-1 block rounded-md bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-600">
                Hospital sign in
              </Link>
            </div>
          </details>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* Decorative background accents — purely visual, no layout impact */}
        <div className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-brand-200/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute left-[-8%] top-40 h-56 w-56 rounded-full bg-gold-200/25 blur-3xl" aria-hidden="true" />

        <div className="animate-rise-in relative mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-brand-600">
                <Sparkles className="h-3.5 w-3.5" /> Antenatal Care Data Analytics
              </p>
              <h1 className="mt-3 font-display text-4xl italic leading-tight text-ink sm:text-5xl">
                One record, from first visit to delivery.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
                MeeronBi follows a pregnancy through every stage of antenatal care — personal
                history, investigations, scans, delivery, and follow-up treatment — in a single
                connected record that staff, patients, and researchers can each see their part of.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/public/trends" className="btn-secondary">
                  <BarChart3 className="h-4 w-4" /> View public trends
                </Link>
                <Link href="/login?role=admin" className="btn-primary group">
                  <Stethoscope className="h-4 w-4" /> Hospital sign in to add data
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <CareTimeline size="lg" />
            </div>
          </div>
          <div className="mt-10 lg:hidden">
            <CareTimeline />
          </div>
        </div>
      </section>

      {/* Mission */}
      <section id="mission" className="scroll-mt-16 border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-600">
            <Heart className="h-4 w-4" /> Our mission
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-2xl italic text-ink sm:text-3xl">
            Safer pregnancies, built on better records — not more paperwork.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            Antenatal care generates a lot of data — history, labs, scans, delivery outcomes —
            but it&apos;s often scattered across paper registers that are hard to search and harder
            to learn from. MeeronBi keeps that same information in one connected record per
            patient, entered once by hospital staff, visible to the patient it belongs to, and
            available in aggregate — never individually — to guide research and policy, including
            reducing unnecessary caesarean sections through the WHO&apos;s Robson classification
            framework.
          </p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-medium text-brand-600">Who it&apos;s for</p>
        <h2 className="mt-2 font-display text-2xl italic text-ink sm:text-3xl">
          Three views of the same record.
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {entryPoints.map((entry) => {
            const Icon = entry.icon;
            const accent = accentClasses[entry.accent];
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`group flex h-full flex-col rounded-lg border border-line bg-white p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-md ${accent.border}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${accent.badge}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{entry.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">{entry.body}</p>
                <span className={`mt-4 flex items-center gap-1 text-sm font-medium ${accent.cta}`}>
                  {entry.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Team */}
      <section id="team" className="scroll-mt-16 border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm font-medium text-brand-600">Our team</p>
          <h2 className="mt-2 font-display text-2xl italic text-ink sm:text-3xl">
            Clinicians, engineers, and the community, in one project.
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {team.map((member) => {
              const Icon = member.icon;
              return (
                <div
                  key={member.role}
                  className="panel border-l-2 border-brand-200 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="font-semibold text-ink">{member.role}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{member.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink-faint">
          <p className="font-display text-base italic text-ink">MeeronBi</p>
          <p className="mt-1 max-w-md">
            Antenatal Care Data Analytics — preserving maternal health knowledge with the help of
            better systems.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/public/trends" className="hover:text-brand-600">
              Public trends
            </Link>
            <Link href="/login?role=patient" className="hover:text-brand-600">
              Patient sign in
            </Link>
            <Link href="/login?role=admin" className="hover:text-brand-600">
              Hospital sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
