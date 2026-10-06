import Skeleton from "@/components/ui/Skeleton";

// Rendered inside AdminLayout (Next nests loading.tsx within the sibling layout), so content only — no sidebar/main shell.
export default function AdminLoading() {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line pb-5">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
