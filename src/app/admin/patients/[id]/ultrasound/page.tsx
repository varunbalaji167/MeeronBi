import TabRecordView from "@/components/patient/TabRecordView";
import { loadAdminTabPageData } from "@/server/patients/adminTabPageData";

export default async function Page({ params }: { params: { id: string } }) {
  const { initialRecord, initialFieldSelection, initialPersonalLmp } = await loadAdminTabPageData("ultrasound", params.id);
  return (
    <TabRecordView
      tabKey="ultrasound"
      patientId={params.id}
      initialRecord={initialRecord}
      initialFieldSelection={initialFieldSelection}
      initialPersonalLmp={initialPersonalLmp}
    />
  );
}
