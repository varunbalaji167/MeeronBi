"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import CareTimeline from "@/components/patient/CareTimeline";
import { CheckCircle2, Mail, Lock } from "lucide-react";

const copy = {
  patient: {
    eyebrow: "Patient Portal",
    heading: "Your care, on record.",
    body: "Sign in to see your own antenatal record — visits, scans, and results — exactly as your care team entered it.",
    bullets: [
      "Read-only — nothing here can be edited but you",
      "The same record your hospital staff keep, always up to date",
      "Ask your care team for a login if you don't have one yet",
    ],
  },
  admin: {
    eyebrow: "Hospital Staff",
    heading: "One record, every visit.",
    body: "Sign in to record and manage antenatal care data across every stage — personal history through delivery — with drafts saved as you go.",
    bullets: [
      "Save incomplete tabs as drafts, come back anytime",
      "Autosaves when you move between tabs",
      "Aggregate trends stay anonymized — no patient-level exposure",
    ],
  },
  researcher: {
    eyebrow: "Research Access",
    heading: "De-identified trends, for real research.",
    body: "Sign in to explore aggregate, disclosure-controlled analytics — never an individual patient row — once your access request is approved.",
    bullets: [
      "Every result is aggregate and cell-size suppressed",
      "Access is reviewed and approved by the MeeronBi team",
      "No account yet? Request access below",
    ],
  },
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const roleHintParam = params.get("role");
  const roleHint = roleHintParam === "patient" ? "patient" : roleHintParam === "researcher" ? "researcher" : "admin";
  const { role, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const content = copy[roleHint];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Only toast when this page itself just completed a sign-in (i.e. the
    // person submitted the form and we're now authenticated) — not when
    // landing here already signed in, which redirects immediately without
    // this having been "an action that just happened."
    if (submitting) showToast("Signed in successfully.", "success");
    router.replace(
      role === "ADMIN" || role === "SUPER_ADMIN" ? "/admin" : role === "PATIENT" ? "/patient" : role === "RESEARCHER" ? "/researcher" : "/"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, role, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setSubmitting(false);
        // NextAuth collapses a bare `return null` from authorize() into the
        // generic string "CredentialsSignin" — anything else is a message
        // we deliberately threw ourselves (see authOptions.ts's authorize:
        // a pending/rejected researcher gets a specific reason, not just
        // "wrong password"), so show it as-is rather than overwriting it
        // with the generic mismatch text.
        setError(res.error === "CredentialsSignin" ? "That email and password don't match our records." : res.error);
        return;
      }
      // Leave `submitting` true — the effect above redirects once
      // useSession() picks up the new cookie.
    } catch {
      // signIn() itself rejecting (rather than resolving with res.error)
      // means the request never reached the server at all.
      setSubmitting(false);
      setError("Could not reach the server. Check your connection and try again.");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / context panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 px-10 py-10 text-brand-50 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative">
          <Link href="/" className="font-display text-xl italic text-white">
            MeeronBi
          </Link>
        </div>

        <div className="relative max-w-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-200">
            {content.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl italic leading-tight text-white">
            {content.heading}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">{content.body}</p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {content.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-brand-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-lg border border-white/10 bg-white/5 p-4">
          <CareTimeline size="sm" variant="dark" />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="text-sm font-medium text-brand-600 lg:hidden">
            ← MeeronBi
          </Link>

          <div className="mt-4 flex flex-wrap gap-2 lg:mt-0">
            <Link
              href="/login?role=patient"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleHint === "patient" ? "bg-brand-50 text-brand-700" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              Patient
            </Link>
            <Link
              href="/login?role=admin"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleHint === "admin" ? "bg-brand-50 text-brand-700" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              Hospital staff
            </Link>
            <Link
              href="/login?role=researcher"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleHint === "researcher" ? "bg-brand-50 text-brand-700" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              Researcher
            </Link>
          </div>

          <h1 className="mt-4 font-display text-3xl italic text-ink">
            {roleHint === "patient" ? "Patient sign in" : roleHint === "researcher" ? "Researcher sign in" : "Hospital staff sign in"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {roleHint === "patient"
              ? "View your antenatal care record."
              : roleHint === "researcher"
                ? "Access de-identified analytics once your request is approved."
                : "Enter antenatal care data for your patients."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="label-text">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  required
                  autoFocus
                  className="input-field pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password"
                  required
                  className="input-field pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <button type="submit" disabled={submitting} className="btn-primary mt-1">
              {submitting && <Spinner className="h-4 w-4" light />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs text-ink-faint">
            {roleHint === "patient" ? (
              "Don't have a login yet? Ask your hospital's care team to set one up for you."
            ) : roleHint === "researcher" ? (
              <>
                Don&apos;t have a login yet?{" "}
                <Link href="/researcher-access" className="font-medium text-brand-600 hover:underline">
                  Request researcher access
                </Link>
                .
              </>
            ) : (
              "Need an account? Contact your MeeronBi administrator."
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
