"use client";

import RouteErrorBoundary from "@/components/ui/RouteErrorBoundary";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorBoundary error={error} reset={reset} sectionLabel="MeeronBi" />;
}
