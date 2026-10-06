import { getSession, requireSuperAdminSession } from "@/server/auth/guards";
import { listFacilities } from "@/server/facilities/facilityRepository";
import FacilitiesClient from "./FacilitiesClient";

export default async function FacilitiesPage() {
  const session = await getSession();
  if (session?.user.role !== "SUPER_ADMIN") {
    return (
      <div className="panel">
        <p className="text-sm text-ink-soft">This page is only available to MeeronBi super admins.</p>
      </div>
    );
  }
  await requireSuperAdminSession(); // also checks the session isn't stale before reading cross-facility data

  return <FacilitiesClient initialFacilities={await listFacilities()} />;
}
