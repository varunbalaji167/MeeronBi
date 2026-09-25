import { notFound } from "next/navigation";
import { assertPatientRecordAccessible } from "@/server/auth/guards";
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
  // Reuses the same guard the per-tab API routes use (see
  // server/auth/guards.ts), rather than duplicating the ADMIN/SUPER_ADMIN/
  // facility logic inline here a second time — it already handles
  // SUPER_ADMIN's cross-facility access correctly, which a bare
  // `role !== "ADMIN"` check here previously did not (SUPER_ADMIN was
  // wrongly 404'd). notFound() covers both "no session" and "not this
  // caller's patient" the same way the API layer does.
  let session;
  try {
    session = await assertPatientRecordAccessible(params.id);
  } catch {
    notFound();
  }
  if (session.user.role === "PATIENT") notFound(); // this layout is staff-only; the patient portal has its own read-only view

  // SUPER_ADMIN isn't scoped to one facility (see guards.ts) — omitting
  // the filter here is safe specifically because assertPatientRecordAccessible
  // above already confirmed this exact patient is reachable by this session.
  const patient = await getPatientHeaderInfo(
    params.id,
    session.user.role === "SUPER_ADMIN" ? undefined : session.user.facilityId
  );
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
