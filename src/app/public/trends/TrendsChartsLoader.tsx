"use client";

import dynamic from "next/dynamic";
import Skeleton from "@/components/ui/Skeleton";

// recharts is ~100KB+ gzipped, so it loads after first paint; `ssr: false` is only legal from a
// Client Component, which is why this thin wrapper exists rather than dynamic() in the page.
const TrendsCharts = dynamic(() => import("./TrendsCharts"), {
  ssr: false,
  loading: () => (
    <>
      <Skeleton className="h-72 w-full sm:col-span-3" />
      <Skeleton className="h-72 w-full sm:col-span-1" />
      <Skeleton className="h-72 w-full sm:col-span-2" />
    </>
  ),
});

export default TrendsCharts;
