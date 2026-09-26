import { requireResearcherSession } from "@/server/auth/guards";
import AnalyticsWorkbench from "@/components/analytics/AnalyticsWorkbenchLoader";

export const dynamic = "force-dynamic";

export default async function ResearcherHomePage() {
  // Re-checks approval fresh against the database so a revoked researcher is blocked immediately.
  let approved = true;
  try {
    await requireResearcherSession();
  } catch {
    approved = false;
  }

  if (!approved) {
    return (
      <div className="panel">
        <h1 className="font-display text-xl italic text-ink">Access not currently approved</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your researcher access isn&apos;t active right now — it may still be pending review, or may have been revoked.
          Contact the MeeronBi team if you believe this is unexpected.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 font-display text-xl italic text-ink">Analytics</h1>
      <AnalyticsWorkbench />
    </div>
  );
}
