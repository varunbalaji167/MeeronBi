import { notFound } from "next/navigation";
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
  const patient = await getPatientHeaderInfo(params.id);
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
