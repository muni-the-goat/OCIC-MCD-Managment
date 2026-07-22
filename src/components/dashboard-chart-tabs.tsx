"use client";

import { ClipboardList, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Both panels arrive already rendered on the server and are passed straight
// through as props, so neither summary is pulled into the client bundle and
// switching tabs costs no round trip.
//
// The inactive panel is left to unmount rather than hidden with forceMount: a
// display:none panel measures zero width, and recharts' responsive container
// would lay its charts out against that. Remounting replays the same server
// output, so nothing is refetched.
export function DashboardChartTabs({
  budget,
  tasks,
}: {
  budget?: React.ReactNode;
  tasks: React.ReactNode;
}) {
  // With no budget access there is nothing to switch between, and a one-tab
  // rail is just chrome around a single card.
  if (!budget) return <>{tasks}</>;

  return (
    <Tabs defaultValue="budget">
      <TabsList aria-label="Dashboard charts">
        <TabsTrigger value="budget">
          <Wallet aria-hidden="true" />
          Annual budget
        </TabsTrigger>
        <TabsTrigger value="tasks">
          <ClipboardList aria-hidden="true" />
          Monthly report
        </TabsTrigger>
      </TabsList>
      <TabsContent value="budget">{budget}</TabsContent>
      <TabsContent value="tasks">{tasks}</TabsContent>
    </Tabs>
  );
}
