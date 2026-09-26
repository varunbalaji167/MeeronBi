"use client";

import dynamic from "next/dynamic";
import { FieldPickerSkeleton, ResultSkeleton } from "./AnalyticsSkeletons";

// The workbench fetches with the browser's session cookie via relative URLs — it has no sensible
// server-rendered form, so it's excluded from SSR entirely (`ssr: false` is only legal from a
// Client Component, which is why this thin wrapper exists) rather than made to suspend through it.
const AnalyticsWorkbench = dynamic(() => import("./AnalyticsWorkbench"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="panel">
        <FieldPickerSkeleton />
      </div>
      <ResultSkeleton />
    </div>
  ),
});

export default AnalyticsWorkbench;
