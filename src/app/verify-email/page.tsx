"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import { toApiError, friendlyErrorMessage } from "@/lib/apiClient";
import { CheckCircle2, XCircle } from "lucide-react";

type Status = "checking" | "success" | "error";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This page needs a link from your email.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw await toApiError(res, "Could not verify your email.");
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setMessage(friendlyErrorMessage(err, "Could not verify your email."));
      }
    })();
  }, [token]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="panel max-w-md text-center">
        {status === "checking" && (
          <>
            <Spinner className="mx-auto h-8 w-8" />
            <h1 className="mt-4 font-display text-2xl italic text-ink">Verifying your email…</h1>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
            <h1 className="mt-4 font-display text-2xl italic text-ink">Email verified</h1>
            <p className="mt-2 text-sm text-ink-soft">You can now sign in once your access request is approved.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-4 font-display text-2xl italic text-ink">Verification failed</h1>
            <p className="mt-2 text-sm text-ink-soft">{message}</p>
          </>
        )}
        <Link href="/login" className="btn-secondary mt-6 inline-flex">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
