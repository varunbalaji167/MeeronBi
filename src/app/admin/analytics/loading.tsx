import Skeleton from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-32" />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="panel flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="panel lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
