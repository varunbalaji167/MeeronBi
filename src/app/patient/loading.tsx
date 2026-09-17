import Skeleton from "@/components/ui/Skeleton";

export default function PatientPortalLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white p-5 lg:flex">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-5 w-32" />
        <div className="mt-8 flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </aside>
      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
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
      </main>
    </div>
  );
}
