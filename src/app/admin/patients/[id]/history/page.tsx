import TabRecordView from "@/components/patient/TabRecordView";

export default function Page({ params }: { params: { id: string } }) {
  return <TabRecordView tabKey="history" patientId={params.id} />;
}
