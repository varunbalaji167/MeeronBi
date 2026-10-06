import { getSession, requirePatientSession } from "@/server/auth/guards";
import { getTabRecord } from "@/server/patients/tabRecordRepository";
import { allTabs } from "@/domain/tabs";
import PageHeader from "@/components/ui/PageHeader";
import PatientRecordClient from "./PatientRecordClient";

export default async function PatientRecordPage() {
  const patientId = (await getSession())?.user.patientId;
  if (!patientId) {
    return (
      <p className="panel text-sm text-ink-soft">
        No antenatal care record is linked to your account yet. Please contact the hospital.
      </p>
    );
  }
  await requirePatientSession(); // fresh-session check; patientId comes from the session itself, so it's always the patient's own record

  const records = await Promise.all(allTabs.map((t) => getTabRecord(t.key, patientId)));
  const initialRecords = Object.fromEntries(
    allTabs.map((t, i) => [t.key, records[i] ? { data: records[i]!.data, status: records[i]!.status } : undefined])
  );
  const personalLmp = (initialRecords.personal?.data.lmp as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My Antenatal Care Record"
        description="A read-only view of your record. Contact hospital staff if anything needs correction."
      />
      <PatientRecordClient patientId={patientId} initialRecords={initialRecords} personalLmp={personalLmp} />
    </div>
  );
}
