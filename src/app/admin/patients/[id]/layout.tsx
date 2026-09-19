import { notFound } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import { getPatientHeaderInfo } from "@/server/patients/patientRepository";
import PatientTabNav from "@/components/patient/PatientTabNav";
import PatientHeader from "@/components/patient/PatientHeader";
import { allTabs } from "@/domain/tabs";
import type { StageStatus } from "@/components/patient/CareTimeline";
import { TabFormProvider } from "@/context/TabFormContext";

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  // Facility-scoped: a patient at a different facility 404s here rather
  // than rendering — this page has no other access-control check of its
  // own (the tab data underneath is separately guarded per-request, but
  // the header/nav shell itself should never render for a patient outside
  // the signed-in admin's facility). Middleware only confirms the ADMIN
  // role, not facility ownership, so this check is still needed here.
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const patient = await getPatientHeaderInfo(params.id, session.user.facilityId);
  if (!patient) notFound();

  const statusByKey: Record<string, StageStatus> = {};
  for (const tab of allTabs) {
    const rec = (patient as any)[tab.key] as { status: string } | null;
    statusByKey[tab.key] = rec ? (rec.status === "COMPLETE" ? "complete" : "draft") : "empty";
  }

  return (
    <TabFormProvider>
      <div className="flex flex-col gap-5">
        <PatientHeader
          patientId={patient.id}
          fullName={patient.fullName}
          mrn={patient.mrn}
          contactNo={patient.contactNo}
          currentEmail={patient.user?.email ?? null}
        />
        <PatientTabNav patientId={patient.id} statusByKey={statusByKey} />
        <div>{children}</div>
      </div>
    </TabFormProvider>
  );
}
