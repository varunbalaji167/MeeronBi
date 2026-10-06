"use client";

import { useState } from "react";
import { allTabs } from "@/domain/tabs";
import TabRecordView from "@/components/patient/TabRecordView";
import CareTimeline from "@/components/patient/CareTimeline";
import type { InitialTabRecord } from "@/hooks/useTabRecord";

interface Props {
  patientId: string;
  /** Server-read records keyed by tab, so switching stages needs no fetch. */
  initialRecords: Record<string, InitialTabRecord | undefined>;
  personalLmp: string | null;
}

export default function PatientRecordClient({ patientId, initialRecords, personalLmp }: Props) {
  const [activeKey, setActiveKey] = useState(allTabs[0].key);
  const activeTab = allTabs.find((t) => t.key === activeKey)!;

  return (
    <>
      <div className="panel py-4">
        <CareTimeline activeKey={activeKey} onSelectKey={setActiveKey} />
      </div>
      {/* Keyed so each stage mounts with its own seed — the hook only skips the fetch for the key it started on. */}
      <TabRecordView
        key={activeKey}
        tabKey={activeTab.key}
        patientId={patientId}
        readOnly
        initialRecord={initialRecords[activeKey]}
        initialPersonalLmp={personalLmp}
      />
    </>
  );
}
