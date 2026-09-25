import { requireResearcherSession } from "@/server/auth/guards";
import { LineChart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResearcherHomePage() {
  // The layout already redirected anyone whose cached session role isn't
  // RESEARCHER — this goes one step further and re-checks approval status
  // fresh against the database (see requireResearcherSession's comment):
  // a researcher whose access was revoked after they already had a valid
  // session cookie should see that reflected immediately here, not only
  // once their 30-day JWT happens to expire.
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
    <div className="panel">
      <LineChart className="h-8 w-8 text-brand-500" />
      <h1 className="mt-3 font-display text-xl italic text-ink">Analytics — coming soon</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        Your access is approved. The field-level analytics tool (pick a field, optionally filter by another, see
        de-identified aggregate stats and charts) is still being built — see{" "}
        <code className="rounded bg-paper px-1 py-0.5 text-xs">docs/ANALYTICS_PLAN.md</code> for the design. Every
        result you&apos;ll see here is aggregate and disclosure-controlled — never an individual patient row — the same
        principle the public trends page already follows, just with a broader set of fields available to you as an
        approved researcher.
      </p>
    </div>
  );
}
