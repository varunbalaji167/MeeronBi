import { redirect } from "next/navigation";

export default function PatientIndexRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/patients/${params.id}/personal`);
}
