import Link from "next/link";
import { Plus } from "lucide-react";
import { ReportFilters } from "@/components/report-filters";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfile, isReviewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetPeriod,
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
  author: { full_name: string; email: string } | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; author?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  const supabase = await createClient();
  const reviewer = isReviewer(profile.role);

  let query = supabase
    .from("reports")
    .select(
      "id, type, budget_period, title, period_month, period_year, status, updated_at, author:profiles!author_id(full_name, email)"
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
  if (reviewer && params.author) {
    query = query.eq("author_id", params.author);
  }

  const { data } = await query;
  const reports = (data ?? []) as unknown as ReportRow[];

  let authors: { id: string; label: string }[] = [];
  if (reviewer) {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {reviewer
              ? "All submitted reports across the office, plus your own."
              : "Your budget and monthly reports."}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/reports/new">
            <Plus className="size-4" />
            New report
          </Link>
        </Button>
      </div>

      <ReportFilters authors={authors} showAuthorFilter={reviewer} />

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No reports match. Create one with “New report”.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                {reviewer ? <TableHead>Author</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-medium hover:underline"
                    >
                      {report.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {reportTypeLabel(report.type, report.budget_period)}
                  </TableCell>
                  <TableCell>
                    {reportPeriodLabel(
                      report.type,
                      report.period_month,
                      report.period_year,
                      report.budget_period
                    )}
                  </TableCell>
                  {reviewer ? (
                    <TableCell>
                      {report.author?.full_name || report.author?.email || "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <StatusBadge status={report.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(report.updated_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
