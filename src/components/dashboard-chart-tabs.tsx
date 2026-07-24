"use client";

import { ClipboardList, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Both panels arrive already rendered on the server and are passed straight
// through as props, so neither summary is pulled into the client bundle and
// switching tabs costs no round trip.
//
// The inactive panel is left to unmount rather than hidden with forceMount: a
// display:none panel measures zero width, and the budget chart's responsive
// container would lay itself out against that. Remounting replays the same
// server output, so nothing is refetched.
export function DashboardChartTabs({
  budget,
  activity,
}: {
  budget?: React.ReactNode;
  activity: React.ReactNode;
}) {
  // With no budget access there is nothing to switch between, and a one-tab
  // rail is just chrome around a single card.
  if (!budget) return <>{activity}</>;

  return (
    <Tabs defaultValue="budget">
      <TabsList aria-label="Dashboard charts">
        <TabsTrigger value="budget">
          <Wallet aria-hidden="true" />
          Annual budget
        </TabsTrigger>
        <TabsTrigger value="activity">
          <ClipboardList aria-hidden="true" />
          Monthly activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="budget">{budget}</TabsContent>
      <TabsContent value="activity">{activity}</TabsContent>
    </Tabs>
  );
}
