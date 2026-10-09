import { ReportDetailSkeleton } from "@/components/page-skeletons";

// Opening a report from the list stays inside the reports segment, below the
// app-wide boundary, so it needs a boundary of its own to show anything.
export default function ReportLoading() {
  return <ReportDetailSkeleton />;
}
