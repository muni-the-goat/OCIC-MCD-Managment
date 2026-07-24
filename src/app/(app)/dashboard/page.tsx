import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  AnnualBudgetSummary,
  AnnualBudgetSummarySkeleton,
} from "@/components/annual-budget-summary";
import { DashboardChartTabs } from "@/components/dashboard-chart-tabs";
import { GaugeStatCard, StatusMix } from "@/components/dashboard-stats";
import { DepartmentBadge } from "@/components/department-badge";
import {
  MonthlyActivitySummary,
  MonthlyActivitySummarySkeleton,
} from "@/components/monthly-activity-summary";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canViewAnnualBudget, getProfile, isReviewer } from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import {
  periodLabel,
  reportPeriodLabel,
  reportTypeLabel,
  roleLabel,
  type BudgetPeriod,
  type Department,
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
  author: {
    full_name: string;
    email: string;
    department: Department | null;
  } | null;
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </span>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    budget_year?: string;
    budget_author?: string;
    task_year?: string;
    task_month?: string;
    task_author?: string;
  }>;
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

  const mineOnly = !reviewer;

  let recentQuery = supabase
    .from("reports")
    .select(
      "id, title, type, budget_period, status, period_month, period_year, updated_at, author:profiles!author_id(full_name, email, department)"
    )
    .order("updated_at", { ascending: false })
    .limit(6);
  if (reviewer) {
    // Reviewers care about the pending queue first.
    recentQuery = recentQuery.eq("status", "submitted");
  } else {
    // Scoped explicitly rather than left to RLS, so the rows always match the
    // heading above them. Managers and Staff see only their own reports anyway;
    // stating it here means a future widening of RLS cannot quietly fill a card
    // titled "Recent reports" with other people's rows.
    recentQuery = recentQuery.eq("author_id", profile.id);
  }

  const [
    total,
    submitted,
    reviewed,
    rejected,
    { data: recentData },
    departments,
  ] = await Promise.all([
    countBy(undefined, mineOnly),
    countBy("submitted", mineOnly),
    countBy("reviewed", mineOnly),
    countBy("rejected", mineOnly),
    recentQuery,
    getDepartments(),
  ]);
  const recent = (recentData ?? []) as unknown as RecentReport[];

  // The four statuses are exhaustive, so whatever the three tracked ones do not
  // account for is still in draft.
  const drafts = Math.max(0, total - submitted - reviewed - rejected);
  const now = new Date();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <LayoutDashboard className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                MCD workspace
              </p>
              <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
                Welcome, {profile.full_name || profile.email}
              </h1>
              <p className="text-sm text-muted-foreground">
                {reviewer
                  ? "Here's what needs your attention."
                  : "Here's where your reports stand."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip icon={CalendarDays}>
              {periodLabel(now.getMonth() + 1, now.getFullYear())}
            </Chip>
            <Chip icon={ShieldCheck}>{roleLabel(profile.role)}</Chip>
            <Chip icon={FileText}>
              {total} {reviewer ? "reports" : "my reports"}
            </Chip>
            <Button asChild size="sm" className="gap-1.5 rounded-full">
              <Link href="/reports/new">
                <Plus className="size-4" />
                New report
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GaugeStatCard
          label="Awaiting review"
          caption="Submitted, not yet decided"
          value={submitted}
          total={total}
          tone="warning"
          icon={Clock}
          href="/reports?status=submitted"
        />
        <GaugeStatCard
          label="Reviewed"
          caption="Approved and counted"
          value={reviewed}
          total={total}
          tone="good"
          icon={CheckCircle2}
          href="/reports?status=reviewed"
        />
        <GaugeStatCard
          label="Rejected"
          caption="Sent back for edits"
          value={rejected}
          total={total}
          tone="critical"
          icon={XCircle}
          href="/reports?status=rejected"
        />
      </div>

      {/* Each tab streams on its own — a slow budget aggregate must not hold up
          the task mix, or the other way round. */}
      <DashboardChartTabs
        budget={
          showAnnualBudget ? (
            <Suspense fallback={<AnnualBudgetSummarySkeleton />}>
              <AnnualBudgetSummary
                userId={profile.id}
                role={profile.role}
                year={params.budget_year}
                author={params.budget_author}
              />
            </Suspense>
          ) : undefined
        }
        activity={
          <Suspense fallback={<MonthlyActivitySummarySkeleton />}>
            <MonthlyActivitySummary
              userId={profile.id}
              role={profile.role}
              year={params.task_year}
              month={params.task_month}
              author={params.task_author}
            />
          </Suspense>
        }
      />


      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>
                {reviewer ? "Pending review" : "Recent reports"}
              </CardTitle>
              <CardDescription>
                {reviewer
                  ? "Submitted reports waiting on a decision."
                  : "Your most recently updated reports."}
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1 rounded-full"
            >
              <Link href="/reports">
                All reports
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  {reviewer
                    ? "Nothing waiting for review."
                    : "No reports yet — create your first one."}
                </p>
              </div>
            ) : (
              <ul className="-mx-2 space-y-1">
                {recent.map((report) => {
                  const TypeIcon = report.type === "budget" ? Wallet : FileText;
                  return (
                    <li key={report.id}>
                      <Link
                        href={`/reports/${report.id}`}
                        className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-card">
                          <TypeIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {report.title}
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate">
                              {reportTypeLabel(
                                report.type,
                                report.budget_period
                              )}{" "}
                              ·{" "}
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
                            {/* Outside the truncating span so a long title never
                                clips the department off the row. */}
                            {reviewer && report.author ? (
                              <DepartmentBadge
                                label={departmentLabel(
                                  report.author.department,
                                  departments
                                )}
                                className="shrink-0"
                              />
                            ) : null}
                          </span>
                        </span>
                        <StatusBadge status={report.status} />
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle>Status mix</CardTitle>
            <CardDescription>
              {reviewer
                ? "Every report you can see, by status."
                : "All of your reports, by status."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-6">
            {total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No reports to summarise yet.
              </p>
            ) : (
              <>
                <StatusMix
                  total={total}
                  segments={[
                    {
                      label: "Reviewed",
                      value: reviewed,
                      tone: "good",
                      href: "/reports?status=reviewed",
                    },
                    {
                      label: "Awaiting review",
                      value: submitted,
                      tone: "warning",
                      href: "/reports?status=submitted",
                    },
                    {
                      label: "Rejected",
                      value: rejected,
                      tone: "critical",
                      href: "/reports?status=rejected",
                    },
                    {
                      label: "Draft",
                      value: drafts,
                      tone: "neutral",
                      href: "/reports?status=draft",
                    },
                  ]}
                />
                <p className="border-t pt-4 text-xs text-muted-foreground">
                  {total} report{total === 1 ? "" : "s"} in total
                  {reviewer ? " across the reports you can access." : "."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
