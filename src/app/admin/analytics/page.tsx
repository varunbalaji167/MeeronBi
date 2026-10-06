import AnalyticsWorkbench from "@/components/analytics/AnalyticsWorkbenchLoader";

export const metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <div>
      <h1 className="mb-5 font-display text-xl italic text-ink">Analytics</h1>
      <AnalyticsWorkbench />
    </div>
  );
}
