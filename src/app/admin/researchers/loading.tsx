import Skeleton from "@/components/ui/Skeleton";

export default function ResearchersLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-72 max-w-full" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 flex gap-2 border-b border-line pb-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel flex items-center gap-4">
            <div className="flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
