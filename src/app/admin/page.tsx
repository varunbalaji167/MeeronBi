import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { requireAdminSession } from "@/server/auth/guards";
import { listPatients } from "@/server/patients/patientRepository";
import { resolvePatientListScope } from "@/server/patients/patientScope";
import { listFacilities } from "@/server/facilities/facilityRepository";
import PatientListFrame from "./PatientListFrame";
import PatientTable from "./PatientTable";
import Pagination from "./Pagination";
import { patientListHref } from "./patientListHref";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminDashboard({ searchParams }: { searchParams: SearchParams }) {
  // The layout redirects unauthenticated users, but pages render alongside it, so guard here too.
  const session = await requireAdminSession();
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const page = Math.max(1, Math.floor(Number(first(searchParams.page))) || 1);
  const q = first(searchParams.q).trim();
  const facilityId = isSuperAdmin ? first(searchParams.facilityId) : "";

  const [result, facilities] = await Promise.all([
    listPatients({ facilityId: resolvePatientListScope(session.user, facilityId || undefined), query: q, page }),
    isSuperAdmin ? listFacilities() : null,
  ]);
  const { patients, pagination } = result;

  // A stale bookmark past the last page lands on the last page rather than an empty table.
  if (pagination.total > 0 && page > pagination.totalPages) {
    redirect(patientListHref({ page: pagination.totalPages, q, facilityId }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patients"
        kicker={`${pagination.total} patients`}
        action={
          <Link href="/admin/patients/new" className={buttonClasses("primary", "md")}>
            <UserPlus className="h-4 w-4" /> New Patient
          </Link>
        }
      />

      <PatientListFrame
        q={q}
        facilityId={facilityId}
        facilities={facilities?.map((f) => ({ id: f.id, name: f.name })) ?? null}
      >
        <PatientTable patients={patients} isSuperAdmin={isSuperAdmin} q={q} facilityId={facilityId} />
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          q={q}
          facilityId={facilityId}
        />
      </PatientListFrame>
    </div>
  );
}
