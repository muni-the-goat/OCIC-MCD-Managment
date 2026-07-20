import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import {
  AnnualBudgetSummary,
  AnnualBudgetSummarySkeleton,
} from "@/components/annual-budget-summary";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canViewAnnualBudget, getProfile, isReviewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetPeriod,
  type ReportStatus,
  type ReportType,
} from "@/lib/types";

export const metadata = { title: "Dashboard" };

interface RecentReport {
  id: string;
  title: string;
  type: ReportType;
  budget_period: BudgetPeriod;
  status: ReportStatus;
  period_month: number;
  period_year: number;
  updated_at: string;
  author: { full_name: string; email: string } | null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ budget_year?: string; budget_author?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  const supabase = await createClient();
  const reviewer = isReviewer(profile.role);
  const showAnnualBudget = canViewAnnualBudget(profile.role);

  const countBy = async (status?: ReportStatus, mineOnly = false) => {
    let query = supabase
      .from("reports")
      .select("id", { count: "exact", head: true });
    if (status) query = query.eq("status", status);
    if (mineOnly) query = query.eq("author_id", profile.id);
    const { count } = await query;
    return count ?? 0;
  };

  let recentQuery = supabase
    .from("reports")
    .select(
      "id, title, type, budget_period, status, period_month, period_year, updated_at, author:profiles!author_id(full_name, email)"
    )
    .order("updated_at", { ascending: false })
    .limit(6);
  if (reviewer) {
    // Reviewers care about the pending queue first.
    recentQuery = recentQuery.eq("status", "submitted");
  }

  // Staff only ever see their own rows through RLS; scoping is for reviewers.
  const mineOnly = !reviewer;
  const [total, submitted, reviewed, rejected, { data: recentData }] =
    await Promise.all([
      countBy(undefined, mineOnly),
      countBy("submitted", mineOnly),
      countBy("reviewed", mineOnly),
      countBy("rejected", mineOnly),
      recentQuery,
    ]);
  const recent = (recentData ?? []) as unknown as RecentReport[];

  const stats = [
    {
      label: reviewer ? "All reports" : "My reports",
      value: total,
      icon: FileText,
    },
    { label: "Awaiting review", value: submitted, icon: Clock },
    { label: "Reviewed", value: reviewed, icon: CheckCircle2 },
    { label: "Rejected", value: rejected, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {profile.full_name || profile.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reviewer
            ? "Here's what needs your attention."
            : "Here's where your reports stand."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showAnnualBudget ? (
        <Suspense fallback={<AnnualBudgetSummarySkeleton />}>
          <AnnualBudgetSummary
            userId={profile.id}
            role={profile.role}
            year={params.budget_year}
            author={params.budget_author}
          />
        </Suspense>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>
            {reviewer ? "Pending review" : "Recent reports"}
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/reports">
              All reports
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {reviewer
                ? "Nothing waiting for review."
                : "No reports yet — create your first one."}
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/reports/${report.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {report.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {reportTypeLabel(report.type, report.budget_period)} ·{" "}
                        {reportPeriodLabel(
                          report.type,
                          report.period_month,
                          report.period_year,
                          report.budget_period
                        )}
                        {reviewer && report.author
                          ? ` · ${report.author.full_name || report.author.email}`
                          : ""}
                      </span>
                    </span>
                    <StatusBadge status={report.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
