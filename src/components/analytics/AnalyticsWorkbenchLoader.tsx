"use client";

import dynamic from "next/dynamic";
import { FieldPickerSkeleton, ResultSkeleton } from "./AnalyticsSkeletons";

// `ssr: false` requires a Client Component wrapper — the workbench fetches with the browser's session cookie.
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
