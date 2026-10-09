"use client";

import { useState } from "react";
import { ClipboardList, Wallet } from "lucide-react";
import { LiquidTabs } from "@/components/liquid-tabs";

// Both panels arrive already rendered on the server and are passed straight
// through as props, so neither summary is pulled into the client bundle and
// switching tabs costs no round trip.
//
// The inactive panel is left unmounted rather than hidden: a display:none
// panel measures zero width, and the budget chart's responsive container would
// lay itself out against that. Remounting replays the same server output, so
// nothing is refetched.
export function DashboardChartTabs({
  budget,
  activity,
}: {
  budget?: React.ReactNode;
  activity: React.ReactNode;
}) {
  const [tab, setTab] = useState("budget");

  // With no budget access there is nothing to switch between, and a one-tab
  // rail is just chrome around a single card.
  if (!budget) return <>{activity}</>;

  return (
    <div className="flex flex-col gap-4">
      <LiquidTabs
        idPrefix="dashboard-charts"
        label="Dashboard charts"
        value={tab}
        onChange={setTab}
        className="self-start"
        options={[
          { value: "budget", label: "Annual budget", icon: Wallet },
          { value: "activity", label: "Monthly activity", icon: ClipboardList },
        ]}
      />
      <div
        role="tabpanel"
        id={`dashboard-charts-panel-${tab}`}
        aria-labelledby={`dashboard-charts-tab-${tab}`}
        className="min-w-0"
      >
        {tab === "budget" ? budget : activity}
      </div>
    </div>
  );
}
