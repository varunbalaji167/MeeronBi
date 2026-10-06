"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { Lock, CheckCircle2 } from "lucide-react";

export default function SetPasswordForm({ token, heading, body }: { token: string; heading: string; body: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw await toApiError(res, "Could not set your password.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Could not set your password."));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
        <div className="panel max-w-md text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
          <h1 className="mt-4 font-display text-2xl italic text-ink">Password set</h1>
          <p className="mt-2 text-sm text-ink-soft">Taking you to sign in…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl italic text-ink">{heading}</h1>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>

        <form onSubmit={handleSubmit} className="panel mt-6 flex flex-col gap-4">
          <div>
            <label className="label-text">New password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                autoFocus
                minLength={6}
                className="input-field pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
          <div>
            <label className="label-text">Confirm password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                minLength={6}
                className="input-field pl-9"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retype your password"
              />
            </div>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button type="submit" disabled={submitting} className="btn-primary mt-1">
            {submitting && <Spinner className="h-4 w-4" light />}
            {submitting ? "Saving…" : "Set password"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
