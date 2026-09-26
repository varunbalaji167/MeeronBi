"use client";

import { useEffect } from "react";

// Top-level error boundary; renders its own html/body since layout.tsx crashed.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center font-sans">
        <p className="font-medium">Something went wrong.</p>
        <p className="text-sm text-neutral-600">
          Try reloading the page.{error.digest ? ` (ref: ${error.digest})` : ""}
        </p>
        <button onClick={reset} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium">
          Try again
        </button>
      </body>
    </html>
  );
}
