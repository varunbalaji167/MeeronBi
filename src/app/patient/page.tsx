"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { allTabs } from "@/domain/tabs";
import TabRecordView from "@/components/patient/TabRecordView";
import CareTimeline from "@/components/patient/CareTimeline";
import PageLoader from "@/components/ui/PageLoader";

export default function PatientRecordPage() {
  const { patientId, isLoading } = useAuth();
  const [activeKey, setActiveKey] = useState(allTabs[0].key);

  if (isLoading) {
    return <PageLoader label="Loading your record…" />;
  }
  if (!patientId) {
    return (
      <p className="panel text-sm text-ink-soft">
        No antenatal care record is linked to your account yet. Please contact the hospital.
      </p>
    );
  }

  const activeTab = allTabs.find((t) => t.key === activeKey)!;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl italic text-ink">My Antenatal Care Record</h2>
        <p className="mt-1 text-sm text-ink-soft">
          A read-only view of your record. Contact hospital staff if anything needs correction.
        </p>
      </div>
      <div className="panel py-4">
        <CareTimeline activeKey={activeKey} onSelectKey={setActiveKey} />
      </div>
      <TabRecordView tabKey={activeTab.key} patientId={patientId} readOnly />
    </div>
  );
}
