"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn, signOut, getSession, getProviders } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import CareTimeline from "@/components/patient/CareTimeline";
import GoogleButton from "@/components/ui/GoogleButton";
import { CheckCircle2, Mail, Lock } from "lucide-react";

// Set just before the full-page redirect to Google, read (and always cleared) on the way back —
// sessionStorage survives that navigation, component state doesn't.
const GOOGLE_PENDING_KEY = "mb_google_signin_pending";

/** Returns whether a Google sign-in attempt from this tab is still pending, clearing the marker
 * either way so it never leaks into an unrelated later visit. */
function clearGooglePendingMarker(): boolean {
  try {
    const wasPending = sessionStorage.getItem(GOOGLE_PENDING_KEY) === "1";
    sessionStorage.removeItem(GOOGLE_PENDING_KEY);
    return wasPending;
  } catch {
    return false;
  }
}

/** Tab-appropriate copy for a Google sign-in rejection — `error` carries the `google-<reason>`
 * code thrown by the signIn callback in server/auth/authOptions.ts. */
function googleErrorMessage(error: string, roleHint: keyof typeof copy): React.ReactNode {
  switch (error) {
    case "google-email-unverified":
      return "Your Google account's email isn't verified yet. Verify it with Google, then try again.";
    case "google-pending":
      // Email is unique per account, so this fires whenever the chosen Google account already has a
      // researcher request — on any tab, not just the researcher one.
      if (roleHint === "researcher") return "Your researcher access request is still pending approval — you'll be notified once it's reviewed.";
      return "That Google account already has a researcher access request pending approval, so it can't sign in here. Use a different Google account, or your regular email/password login.";
    case "google-not-approved":
      if (roleHint === "researcher") return "Your researcher access request was not approved. Contact the MeeronBi team if you have questions.";
      return "That Google account's researcher access request was not approved, so it can't sign in here. Use a different Google account, or your regular email/password login.";
    case "google-no-account":
      if (roleHint === "patient") return "We don't have a login for that Google account — ask your care team to set one up.";
      if (roleHint === "researcher")
        return (
          <>
            We don&apos;t have a login for that Google account.{" "}
            <Link href="/researcher-access" className="font-medium underline">
              Request researcher access
            </Link>
            .
          </>
        );
      return "We don't have a login for that Google account — ask your administrator.";
    default:
      return "Something went wrong signing in with Google. Please try again.";
  }
}

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

/** Roles allowed to sign in from each login tab. */
const ALLOWED_ROLES: Record<keyof typeof copy, string[]> = {
  patient: ["PATIENT"],
  admin: ["ADMIN", "SUPER_ADMIN"],
  researcher: ["RESEARCHER"],
};

const TAB_LABEL: Record<keyof typeof copy, string> = {
  patient: "Patient",
  admin: "Hospital staff",
  researcher: "Researcher",
};

const ROLE_TAB: Record<string, keyof typeof copy> = {
  PATIENT: "patient",
  ADMIN: "admin",
  SUPER_ADMIN: "admin",
  RESEARCHER: "researcher",
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
  const [error, setError] = useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);
  // True while checking the just-signed-in role against this tab; blocks the redirect effect below.
  const [checkingRole, setCheckingRole] = useState(false);
  // NextAuth only reports configured providers at runtime, so the Google button simply doesn't
  // render when GOOGLE_CLIENT_ID is unset — no separate feature flag needed.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    getProviders().then((providers) => setGoogleEnabled(!!providers?.google));
  }, []);

  // A Google sign-in failure is a full-page redirect back with ?error=<code> — there's no
  // client-side result to await like the credentials form gets, so it's read from the URL on mount.
  useEffect(() => {
    const errorCode = params.get("error");
    if (errorCode) setError(googleErrorMessage(errorCode, roleHint));
    // Doesn't clear the pending marker here — this effect and the one below both run on mount, in
    // order, so clearing unconditionally would wipe it before a successful return ever reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !role || checkingRole) return;
    // Google's full-page redirect remounts this component, so `submitting` is always false here —
    // clearGooglePendingMarker reads the sessionStorage flag set just before that redirect instead.
    if (submitting || clearGooglePendingMarker()) showToast("Signed in successfully.", "success");
    router.replace(
      role === "ADMIN" || role === "SUPER_ADMIN" ? "/admin" : role === "PATIENT" ? "/patient" : role === "RESEARCHER" ? "/researcher" : "/"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, role, router, submitting, checkingRole]);

  // No wrong-tab check here, unlike handleSubmit below: Google already tells us exactly who signed
  // in, so the redirect effect above can send them to their real role's home regardless of tab.
  async function handleGoogleSignIn() {
    setGoogleSubmitting(true);
    try {
      sessionStorage.setItem(GOOGLE_PENDING_KEY, "1");
    } catch {
      // Storage can throw in private browsing — the toast is a nicety, never block sign-in over it.
    }
    await signIn("google");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setSubmitting(false);
        // "CredentialsSignin" is NextAuth's generic error; anything else is a specific message we threw.
        setError(res.error === "CredentialsSignin" ? "That email and password don't match our records." : res.error);
        return;
      }

      // Read the fresh session directly so a wrong-tab account is caught before the redirect effect fires.
      setCheckingRole(true);
      const session = await getSession();
      const actualRole = session?.user?.role;
      if (actualRole && !ALLOWED_ROLES[roleHint].includes(actualRole)) {
        await signOut({ redirect: false });
        const correctTab = TAB_LABEL[ROLE_TAB[actualRole] ?? "admin"];
        setError(`That's a ${correctTab.toLowerCase()} account. Switch to the "${correctTab}" tab above to sign in.`);
        setSubmitting(false);
        setCheckingRole(false);
        return;
      }
      setCheckingRole(false);
      // Leave `submitting` true; the effect above redirects now that checkingRole is clear.
    } catch {
      setSubmitting(false);
      setCheckingRole(false);
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
              <div className="flex items-center justify-between">
                <label className="label-text">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
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

          {googleEnabled && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <div className="h-px flex-1 bg-ink-faint/20" />
                or
                <div className="h-px flex-1 bg-ink-faint/20" />
              </div>
              <GoogleButton onClick={handleGoogleSignIn} loading={googleSubmitting} label="Continue with Google" />
            </div>
          )}

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
              "Need an account? Ask MeeronBi team to set one up for you."
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
