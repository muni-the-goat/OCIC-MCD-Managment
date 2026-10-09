import { ReportFormSkeleton } from "@/components/page-skeletons";

// Nearer than the report's own boundary, so Edit shows a form, not a report.
export default function EditReportLoading() {
  return <ReportFormSkeleton />;
}
