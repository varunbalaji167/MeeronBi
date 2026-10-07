import Link from "next/link";
import { Heart, CheckCircle2 } from "lucide-react";
import {
  GrowthRings, GentleWave, LeafPattern, DotGrid, EcgLine,
} from "@/components/ui/decor";

interface AuthBanner {
  eyebrow: string;
  heading: string;
  body: string;
  bullets?: string[];
}

/** Shared page shell for the standalone auth screens (forgot/set password, verify email, researcher access). */
export default function AuthShell({ children, banner }: { children: React.ReactNode; banner?: AuthBanner }) {
  if (banner) {
    return (
      <main className="grid min-h-screen lg:grid-cols-2">
        {/* ── Desktop brand panel (hidden on mobile) ── */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 px-10 py-10 text-brand-50 lg:flex">
          <DotGrid className="pointer-events-none absolute inset-0 opacity-[0.07]" color="white" />
          <GrowthRings
            className="pointer-events-none absolute -right-[10%] -top-[10%] h-[60%] w-[60%] opacity-[0.08]"
            color="rgba(255,255,255,0.4)"
            rings={6}
          />
          <GrowthRings
            className="pointer-events-none absolute -bottom-[15%] -left-[8%] h-[45%] w-[45%] opacity-[0.06]"
            color="rgba(255,255,255,0.3)"
            rings={4}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-20">
            <EcgLine className="h-full w-full text-white" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-10">
            <GentleWave className="h-full w-full text-white" fill />
          </div>

          <div className="relative">
            <Link href="/" className="font-display text-xl italic text-white">
              MeeronBi
            </Link>
          </div>

          <div className="relative max-w-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-200">
              {banner.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl italic leading-tight text-white">
              {banner.heading}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-brand-100">{banner.body}</p>
            {banner.bullets && banner.bullets.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2.5">
                {banner.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-brand-100">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative" />
        </div>

        {/* ── Mobile brand panel (hidden on desktop) ── */}
        <div className="relative overflow-hidden bg-brand-700 px-6 py-8 text-brand-50 sm:px-12 lg:hidden">
          <DotGrid className="pointer-events-none absolute inset-0 opacity-[0.07]" color="white" />
          <GrowthRings
            className="pointer-events-none absolute -right-[8%] -top-[15%] h-[55%] w-[55%] opacity-[0.08]"
            color="rgba(255,255,255,0.35)"
            rings={4}
          />
          <div className="relative mx-auto max-w-sm">
            <Link href="/" className="font-display text-xl italic text-white">
              MeeronBi
            </Link>
            <p className="mt-5 text-xs font-medium uppercase tracking-wider text-brand-200">
              {banner.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-2xl italic leading-tight text-white">
              {banner.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-100">{banner.body}</p>
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="relative flex flex-col justify-center overflow-hidden px-6 py-10 sm:px-12 lg:px-16 lg:py-16">
          <DotGrid className="pointer-events-none absolute inset-0 opacity-[0.2]" color="rgb(var(--brand-500) / 0.06)" size={24} />
          <GrowthRings
            className="pointer-events-none absolute -right-[12%] -top-[12%] h-[45%] w-[45%] opacity-[0.06]"
            color="rgb(var(--brand-500) / 0.12)"
            rings={4}
          />
          <div className="relative mx-auto w-full max-w-md">
            {children}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-paper via-brand-50/30 to-paper px-6 py-16">
      <DotGrid className="absolute inset-0 opacity-[0.35]" color="rgb(var(--brand-500) / 0.08)" size={24} />
      <LeafPattern
        className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
        patternId="leaf-auth"
        color="rgb(var(--brand-500) / 0.04)"
      />
      <GrowthRings
        className="pointer-events-none absolute left-[-10%] top-[-10%] h-[60%] w-[60%] opacity-40"
        color="rgb(var(--brand-500) / 0.05)"
        rings={7}
        cx={50}
        cy={50}
      />
      <GrowthRings
        className="pointer-events-none absolute bottom-[-15%] right-[-10%] h-[50%] w-[50%] opacity-30"
        color="rgb(var(--rose-300) / 0.06)"
        rings={5}
        cx={50}
        cy={50}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-20">
        <GentleWave className="h-full w-full text-brand-400" fill />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-15">
        <GentleWave className="h-full w-full text-rose-300" fill />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20">
            <Heart className="h-4 w-4 animate-beat" fill="currentColor" />
          </span>
          <span className="font-display text-lg italic text-ink transition-colors group-hover:text-brand-700">
            MeeronBi
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
