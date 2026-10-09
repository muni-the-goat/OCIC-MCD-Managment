import { ReportFormSkeleton } from "@/components/page-skeletons";

// Covers both the chooser and the form it leads to (?type=), which share this
// segment — choosing a type is a navigation that lands on a form.
export default function NewReportLoading() {
  return <ReportFormSkeleton />;
}
