import Skeleton from "@/components/ui/Skeleton";

export default function ResearcherLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-40" />
      <div className="panel mt-5 flex flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
