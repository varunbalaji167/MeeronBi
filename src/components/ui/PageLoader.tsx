import Spinner from "./Spinner";

/**
 * Full-width, vertically-roomy centered loader — used for client-side
 * "waiting on a fetch" states (TabRecordView, the patient list, public
 * trends). Distinct from Next's file-based loading.tsx skeletons (see
 * app/admin/loading.tsx etc.), which cover the initial server render of a
 * route before any client JS has run; this covers subsequent client-side
 * fetches within an already-loaded page.
 */
export default function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-ink-faint" role="status">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
