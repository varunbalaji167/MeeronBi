"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

/** Shared body for every route-level error.tsx boundary; reports client render errors to Sentry directly. */
export default function RouteErrorBoundary({
  error,
  reset,
  sectionLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  sectionLabel: string;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="h-8 w-8 text-rose-500" />
      <div>
        <p className="font-medium text-ink">Something went wrong in {sectionLabel}.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Try again, or reload the page if it keeps happening.
          {error.digest ? ` (ref: ${error.digest})` : ""}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-md border border-ink px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
      >
        Try again
      </button>
    </div>
  );
}
