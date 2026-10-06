import Skeleton from "@/components/ui/Skeleton";

export default function FacilitiesLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="panel mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}
