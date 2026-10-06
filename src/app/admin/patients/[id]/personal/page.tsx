import TabRecordView from "@/components/patient/TabRecordView";
import { loadAdminTabPageData } from "@/server/patients/adminTabPageData";

export default async function Page({ params }: { params: { id: string } }) {
  const { initialRecord, initialFieldSelection } = await loadAdminTabPageData("personal", params.id);
  return (
    <TabRecordView
      tabKey="personal"
      patientId={params.id}
      initialRecord={initialRecord}
      initialFieldSelection={initialFieldSelection}
    />
  );
}
