"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";

/** Placeholder shaped like FieldPicker + the quick-pick chips, so nothing jumps once the field registry loads. */
export function FieldPickerSkeleton() {
  return (
    <div role="status" aria-label="Loading fields">
      <Skeleton className="mb-1.5 h-4 w-28" />
      <Skeleton className="h-9 w-full" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-10 rounded-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

const FUN_CAPTIONS = ["Crunching the numbers…", "Counting patients…", "Consulting the data gods…", "Almost there…"];

/** Placeholder shaped like the stat tiles + chart panel a cohort query resolves to. */
export function ResultSkeleton() {
  const [captionIndex, setCaptionIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCaptionIndex((i) => (i + 1) % FUN_CAPTIONS.length), 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5" role="status" aria-label="Loading analytics result">
      <p className="text-sm text-ink-soft">{FUN_CAPTIONS[captionIndex]}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel border-l-2 border-line py-3">
            <Skeleton className="mb-2 h-3 w-14" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="panel">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
