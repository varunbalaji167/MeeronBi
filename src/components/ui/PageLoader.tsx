import Spinner from "./Spinner";

/** Centered loader for client-side fetches, distinct from Next's route-level loading.tsx skeletons. */
export default function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-ink-faint" role="status">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
