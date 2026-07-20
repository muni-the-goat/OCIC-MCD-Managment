import { notFound, redirect } from "next/navigation";
import { ReportForm } from "@/components/report-form";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reportTypeLabel, type BudgetItem, type Report } from "@/lib/types";

export const metadata = { title: "Edit report" };

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, profile] = await Promise.all([params, getProfile()]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const report = data as Report;
  const editable = report.author_id === profile.id || profile.role === "admin";
  if (!editable) redirect(`/reports/${id}`);

  let budgetItems: BudgetItem[] = [];
  if (report.type === "budget") {
    const { data: items } = await supabase
      .from("budget_items")
      .select("*")
      .eq("report_id", id)
      .order("sort_order");
    budgetItems = (items ?? []) as BudgetItem[];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit {reportTypeLabel(report.type, report.budget_period).toLowerCase()} report
      </h1>
      <ReportForm type={report.type} report={report} budgetItems={budgetItems} />
    </div>
  );
}
