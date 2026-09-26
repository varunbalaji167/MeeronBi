"use client";

import RouteErrorBoundary from "@/components/ui/RouteErrorBoundary";

export default function PatientError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorBoundary error={error} reset={reset} sectionLabel="the patient portal" />;
}
