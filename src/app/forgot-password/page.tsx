"use client";

import { useState } from "react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { Mail, CheckCircle2 } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Deliberately identical whether or not the account exists — see the route's privacy-justification comment.
      if (!res.ok) throw await toApiError(res, "Could not submit your request.");
      setSubmitted(true);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Could not submit your request."));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthShell>
        <div className="panel text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
          <h1 className="mt-4 font-display text-2xl italic text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-soft">
            If an account exists for that email, we&apos;ve sent a link to reset your password.
          </p>
          <Link href="/login" className="btn-secondary mt-6 inline-flex">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <Link href="/login" className="text-sm font-medium text-brand-600">
          ← Back to sign in
        </Link>
        <h1 className="mt-3 font-display text-2xl italic text-ink">Forgot your password?</h1>
        <p className="mt-2 text-sm text-ink-soft">Enter your email and we&apos;ll send you a link to set a new one.</p>

        <form onSubmit={handleSubmit} className="panel mt-6 flex flex-col gap-4">
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
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button type="submit" disabled={submitting} className="btn-primary mt-1">
            {submitting && <Spinner className="h-4 w-4" light />}
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
