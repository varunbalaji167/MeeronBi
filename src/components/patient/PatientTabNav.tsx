"use client";

import { usePathname } from "next/navigation";
import CareTimeline, { StageStatus } from "./CareTimeline";
import { allTabs } from "@/domain/tabs";
import { useTabForm } from "@/context/TabFormContext";

export default function PatientTabNav({
  patientId,
  statusByKey,
}: {
  patientId: string;
  statusByKey: Record<string, StageStatus>;
}) {
  const pathname = usePathname();
  const { navigateWithAutosave } = useTabForm();
  const activeTab = allTabs.find((t) => pathname.endsWith(`/${t.route}`));

  return (
    <div className="panel py-4">
      <CareTimeline
        statusByKey={statusByKey}
        activeKey={activeTab?.key}
        hrefBase={`/admin/patients/${patientId}`}
        onNavigate={navigateWithAutosave}
      />
    </div>
  );
}
