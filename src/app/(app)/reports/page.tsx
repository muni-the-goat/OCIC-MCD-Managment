import Link from "next/link";
import { Plus } from "lucide-react";
import { ReportFilters } from "@/components/report-filters";
import { ReportsTable } from "@/components/reports-table";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import {
  canManageAnyReport,
  getProfile,
  livesOnProjectsOnly,
  seesOtherAuthors,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import {
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetPeriod,
  type Department,
  type ReportStatus,
  type ReportType,
} from "@/lib/types";

export const metadata = { title: "Reports" };

interface ReportRow {
  id: string;
  type: ReportType;
  budget_period: BudgetPeriod;
  title: string;
  period_month: number;
  period_year: number;
  status: ReportStatus;
  updated_at: string;
  author: {
    full_name: string;
    email: string;
    department: Department | null;
  } | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; author?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  // The projects side has its own reports and does not read the office's.
  if (livesOnProjectsOnly(profile.role)) redirect("/projects");

  const supabase = await createClient();
  // Neither a Coordinator nor a VP Assistant is a reviewer, and both read past
  // their own reports, so the Author/Department columns, the author filter and
  // the page's own description all follow the wider question rather than
  // isReviewer().
  const showsOtherAuthors = seesOtherAuthors(profile.role);

  let query = supabase
    .from("reports")
    .select(
      "id, type, budget_period, title, period_month, period_year, status, updated_at, author:profiles!author_id(full_name, email, department)"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (params.type === "budget" || params.type === "monthly") {
    query = query.eq("type", params.type);
  } else if (params.type === "budget-monthly") {
    query = query.eq("type", "budget").eq("budget_period", "monthly");
  } else if (params.type === "budget-annual") {
    query = query.eq("type", "budget").eq("budget_period", "annual");
  }
  if (
    params.status &&
    ["draft", "submitted", "reviewed", "rejected"].includes(params.status)
  ) {
    query = query.eq("status", params.status);
  }
  if (showsOtherAuthors && params.author) {
    query = query.eq("author_id", params.author);
  }

  const [{ data }, departments] = await Promise.all([query, getDepartments()]);
  const reports = (data ?? []) as unknown as ReportRow[];
  const reportItems = reports.map((report) => ({
    id: report.id,
    title: report.title,
    typeLabel: reportTypeLabel(report.type, report.budget_period),
    periodLabel: reportPeriodLabel(
      report.type,
      report.period_month,
      report.period_year,
      report.budget_period
    ),
    authorLabel: report.author?.full_name || report.author?.email || "—",
    // Only meaningful once we know who the author is; an orphaned row would
    // otherwise read "Unassigned", which claims more than we know.
    departmentLabel: departmentLabel(report.author?.department, departments),
    hasAuthor: Boolean(report.author),
    status: report.status,
    // Day and month only: the row already sits under its period, and "7 Oct"
    // reads in a narrow column where 10/7/2026 is a puzzle about which
    // number is the month.
    updatedLabel: new Date(report.updated_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    periodSort: report.period_year * 100 + report.period_month,
  }));

  let authors: { id: string; label: string }[] = [];
  if (showsOtherAuthors) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    authors = (profiles ?? []).map((p) => ({
      id: p.id,
      label: p.full_name || p.email,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <h1 className="type-title">Reports</h1>
          <p className="type-subtitle">
            {showsOtherAuthors
              ? "Every submitted report across the office, plus all of your own."
              : "Your monthly budget and activity reports."}
          </p>
        </div>
        <Button
          asChild
          className="h-11 gap-2 rounded-full px-5 text-[0.9375rem] font-semibold"
        >
          <Link href="/reports/new">
            <Plus className="size-[1.125rem]" />
            New report
          </Link>
        </Button>
      </header>

      <ReportFilters authors={authors} showAuthorFilter={showsOtherAuthors} />

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-card px-6 py-14 text-center">
          <p className="type-headline">No reports match these filters.</p>
          <p className="type-callout text-muted-foreground">
            Try another status or type, or start one with New report.
          </p>
        </div>
      ) : (
        <ReportsTable
          key={`${params.type ?? "all"}:${params.status ?? "all"}:${params.author ?? "all"}`}
          reports={reportItems}
          showAuthor={showsOtherAuthors}
          canBulkDelete={canManageAnyReport(profile.role)}
        />
      )}
    </div>
  );
}
