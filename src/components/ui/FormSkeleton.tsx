import Skeleton from "./Skeleton";

/**
 * Shaped like DynamicForm's own layout (header row with a status-pill
 * placeholder, then one or more `.panel` sections of label+input pairs) so
 * that TabRecordView's initial data fetch doesn't hand off from a skeleton
 * (app/**\/loading.tsx, covering the server render) to a spinner
 * (PageLoader, covering the client-side fetch) before finally showing real
 * content — see docs/ARCHITECTURE.md's "Loading UI" section. Using the same
 * skeleton shape for both moments means the person sees one continuous
 * "form is materializing" impression instead of a skeleton→spinner→data
 * flicker.
 */
export default function FormSkeleton({
  panels = 2,
  fieldsPerPanel = 8,
}: {
  panels?: number;
  fieldsPerPanel?: number;
}) {
  return (
    <div className="flex flex-col gap-6 pb-24" role="status" aria-label="Loading form">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      {Array.from({ length: panels }).map((_, i) => (
        <div key={i} className="panel">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: fieldsPerPanel }).map((_, j) => (
              <div key={j}>
                <Skeleton className="mb-1.5 h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
