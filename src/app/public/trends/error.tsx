"use client";

import RouteErrorBoundary from "@/components/ui/RouteErrorBoundary";

export default function TrendsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorBoundary error={error} reset={reset} sectionLabel="the public trends page" />;
}
