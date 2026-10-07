"use client";

import { useState } from "react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { CheckCircle2, GraduationCap, Mail, Building2 } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

export default function CompleteResearcherSignupForm({ email, name: initialName }: { email: string; name: string }) {
  const [name, setName] = useState(initialName);
  const [institution, setInstitution] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/researcher-access/google-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, institution, purpose }),
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
      <AuthShell>
        <div className="panel text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
          <h1 className="mt-4 font-display text-2xl italic text-ink">Request submitted</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your Google account is linked and your email is already verified, so there&apos;s nothing further to
            confirm. The MeeronBi team has been notified — you&apos;ll be able to sign in once it&apos;s reviewed and
            approved.
          </p>
          <Link href="/login?role=researcher" className="btn-secondary mt-6 inline-flex">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      banner={{
        eyebrow: "Research Access",
        heading: "Almost there.",
        body: "Just a few more details to complete your researcher access request.",
        bullets: [
          "Your Google account is already linked",
          "Tell us your institution and research purpose",
          "The MeeronBi team will review your request",
        ],
      }}
    >
      <div>
        <h1 className="font-display text-2xl italic text-ink">Finish your researcher access request</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Signed in as <span className="font-medium text-ink">{email}</span> via Google.
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
              <input type="email" disabled className="input-field pl-9 bg-paper text-ink-faint" value={email} readOnly />
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
      </div>
    </AuthShell>
  );
}
