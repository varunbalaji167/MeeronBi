import PageHeader from "@/components/ui/PageHeader";
import AnalyticsWorkbench from "@/components/analytics/AnalyticsWorkbenchLoader";

export const metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Aggregate, disclosure-controlled results — never an individual patient row."
        className="mb-6"
      />
      <AnalyticsWorkbench />
    </div>
  );
}
