"use client";

import { useState } from "react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { CheckCircle2, GraduationCap, Mail, Lock, Building2 } from "lucide-react";

export default function ResearcherAccessRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          <h1 className="mt-4 font-display text-2xl italic text-ink">Request submitted</h1>
          <p className="mt-2 text-sm text-ink-soft">
            The MeeronBi team will review your request. You&apos;ll be able to sign in once it&apos;s approved — trying to
            sign in before then will tell you it&apos;s still pending, not that your password is wrong.
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
      </div>
    </main>
  );
}
