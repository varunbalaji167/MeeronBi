import Skeleton from "@/components/ui/Skeleton";

// Shown while the [id] layout fetches this specific patient's header info
// (name, MRD, contact, per-tab status) from the database — matches the
// shape of PatientHeader + the CareTimeline stepper + a form panel so the
// page doesn't visually "jump" once the real content arrives.
export default function PatientRecordLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="panel py-4">
        <div className="flex justify-between gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
