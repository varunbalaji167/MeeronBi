// Barrel export — every other layer (components, server, API routes) should
// import tab configs from "@/domain/tabs", never reach into an individual
// file like "@/domain/tabs/personal" directly. That keeps this index the
// single place that defines "what tabs exist and in what order."

import { TabConfig } from "./types";
import { personalTab } from "./personal";
import { historyTab } from "./history";
import { investigationTab } from "./investigation";
import { ultrasoundTab } from "./ultrasound";
import { deliveryTab } from "./delivery";
import { robsonTab } from "./robson";
import { treatmentsTab } from "./treatments";

export * from "./types";
export { personalTab, historyTab, investigationTab, ultrasoundTab, deliveryTab, robsonTab, treatmentsTab };
export { computeRobsonGroup } from "./robson";

/** All 7 tabs, in the order they're navigated (Personal → ... → Treatments). */
export const allTabs: TabConfig[] = [
  personalTab,
  historyTab,
  investigationTab,
  ultrasoundTab,
  deliveryTab,
  robsonTab,
  treatmentsTab,
];

export function getTabByKey(key: string): TabConfig | undefined {
  return allTabs.find((t) => t.key === key);
}
