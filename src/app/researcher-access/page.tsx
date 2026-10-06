"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn, getProviders } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import GoogleButton from "@/components/ui/GoogleButton";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { CheckCircle2, GraduationCap, Mail, Lock, Building2 } from "lucide-react";

const GOOGLE_START_ERROR_MESSAGE: Record<string, string> = {
  "google-link-invalid": "That Google sign-up link isn't valid or has expired. Please try again below.",
};

function ResearcherAccessRequestForm() {
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    getProviders().then((providers) => setGoogleEnabled(!!providers?.["google-signup"]));
  }, []);

  useEffect(() => {
    const startError = params.get("error");
    if (startError && GOOGLE_START_ERROR_MESSAGE[startError]) {
      setError(GOOGLE_START_ERROR_MESSAGE[startError]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleSignUp() {
    setGoogleSubmitting(true);
    await signIn("google-signup");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/researcher-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, institution, purpose }),
      });
      if (!res.ok) throw await toApiError(res, "Failed to submit your request.");
      setSubmitted(true);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Failed to submit your request."));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
        <div className="panel max-w-md text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
          <h1 className="mt-4 font-display text-2xl italic text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-soft">
            We&apos;ve sent a verification link to your email address. Click it to confirm your request — the
            MeeronBi team won&apos;t see it until you do. You&apos;ll be able to sign in once it&apos;s reviewed and
            approved.
          </p>
          <Link href="/login?role=researcher" className="btn-secondary mt-6 inline-flex">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/login?role=researcher" className="text-sm font-medium text-brand-600">
          ← Back to sign in
        </Link>
        <h1 className="mt-3 font-display text-2xl italic text-ink">Request researcher access</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Access is reviewed by the MeeronBi team before it&apos;s active. Every result you&apos;d see is aggregate and
          disclosure-controlled — never an individual patient row.
        </p>

        <form onSubmit={handleSubmit} className="panel mt-6 flex flex-col gap-4">
          <div>
            <label className="label-text">Full Name</label>
            <input required autoFocus className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Dr. Anita Sharma" />
          </div>
          <div>
            <label className="label-text">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="email"
                required
                className="input-field pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
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
                minLength={6}
                className="input-field pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
          <div>
            <label className="label-text">Institution / Affiliation</label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                required
                className="input-field pl-9"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g., RIMS Imphal, Dept. of OBG"
              />
            </div>
          </div>
          <div>
            <label className="label-text">Research Purpose</label>
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-faint" />
              <textarea
                required
                minLength={20}
                rows={4}
                className="input-field resize-y pl-9 pt-2.5"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What are you studying, and what will you use this data for? This is what the reviewer sees."
              />
            </div>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button className="btn-primary mt-1" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" light />}
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>

        {googleEnabled && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-xs text-ink-faint">
              <div className="h-px flex-1 bg-ink-faint/20" />
              or
              <div className="h-px flex-1 bg-ink-faint/20" />
            </div>
            <GoogleButton onClick={handleGoogleSignUp} loading={googleSubmitting} label="Sign up with Google instead" />
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResearcherAccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
          <div className="w-full max-w-md">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="mt-3 h-4 w-full" />
            <div className="panel mt-6 flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </main>
      }
    >
      <ResearcherAccessRequestForm />
    </Suspense>
  );
}
