import Skeleton from "./Skeleton";

/** Placeholder shaped like DynamicForm's layout, avoiding a skeleton-to-spinner flicker on load. */
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
