import Skeleton from "@/components/ui/Skeleton";

// Shown while the AdminLayout server component resolves.
export default function AdminLoading() {
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
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
      </main>
    </div>
  );
}
