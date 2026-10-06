import Skeleton from "@/components/ui/Skeleton";

// Rendered inside PatientLayout (Next nests loading.tsx within the sibling layout), so content only — no sidebar/main shell.
export default function PatientPortalLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 flex justify-between gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
