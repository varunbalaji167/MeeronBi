import { getSession, requireSuperAdminSession } from "@/server/auth/guards";
import { listResearcherRequests } from "@/server/researchers/researcherAccessService";
import ResearchersClient from "./ResearchersClient";

export default async function ResearcherRequestsPage() {
  const session = await getSession();
  if (session?.user.role !== "SUPER_ADMIN") {
    return (
      <div className="panel">
        <p className="text-sm text-ink-soft">This page is only available to MeeronBi super admins.</p>
      </div>
    );
  }
  await requireSuperAdminSession(); // also checks the session isn't stale before reading cross-facility data

  const pending = await listResearcherRequests("PENDING");
  const initialRequests = pending.map((r) => ({
    user: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      createdAt: r.user.createdAt.toISOString(),
      emailVerifiedAt: r.user.emailVerifiedAt?.toISOString() ?? null,
    },
    status: r.status,
    institution: r.institution,
    purpose: r.purpose,
    requestedAt: r.requestedAt.toISOString(),
    reviewedBy: r.reviewedBy ? { name: r.reviewedBy.name, email: r.reviewedBy.email } : null,
    reviewNote: r.reviewNote,
  }));

  return <ResearchersClient initialRequests={initialRequests} />;
}
