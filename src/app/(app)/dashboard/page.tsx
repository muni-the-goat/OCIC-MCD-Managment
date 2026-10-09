import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Inbox,
  Plus,
  Wallet,
} from "lucide-react";
import {
  AnnualBudgetSummary,
  AnnualBudgetSummarySkeleton,
} from "@/components/annual-budget-summary";
import { DashboardChartTabs } from "@/components/dashboard-chart-tabs";
import { StatusBand } from "@/components/dashboard-stats";
import { DepartmentBadge } from "@/components/department-badge";
import {
  MonthlyActivitySummary,
  MonthlyActivitySummarySkeleton,
} from "@/components/monthly-activity-summary";
import { ReportProgressDialog } from "@/components/report-progress-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import {
  canViewAnnualBudget,
  getProfile,
  isReviewer,
  livesOnProjectsOnly,
  seesOtherAuthors,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import {
  progressFromDecisions,
  type DecidedReport,
} from "@/lib/report-progress";
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
  // A VP Assistant has no marketing reporting, so this page would greet them
  // with four zeroes and an empty list. The projects dashboard is their home;
  // src/proxy.ts sends "/" here for everyone, so the redirect belongs here
  // rather than in the middleware, which would have to read a profile to know.
  // Now that the projects side has a dashboard of its own, "Dashboard" means
  // that one for the roles that live there, rather than dropping them on the
  // record table.
  if (livesOnProjectsOnly(profile.role)) redirect("/projects/dashboard");

  const supabase = await createClient();
  // Two questions this page kept asking as one. A Coordinator reads every
  // budget report and decides on none of the activity ones, so the scope of the
  // numbers and the "here is your queue" framing had to come apart:
  //
  //   officeWide  whose reports the counts and the list cover
  //   reviewer    whether the list is a pending-decision queue
  const officeWide = seesOtherAuthors(profile.role);
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

  const mineOnly = !officeWide;

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
  } else if (!officeWide) {
    // Scoped explicitly rather than left to RLS, so the rows always match the
    // heading above them. Managers and Staff see only their own reports anyway;
    // stating it here means a future widening of RLS cannot quietly fill a card
    // titled "Recent reports" with other people's rows.
    recentQuery = recentQuery.eq("author_id", profile.id);
  }

  // The reader's own side of the ledger, for the arrival summary below. Kept
  // apart from the counts above on purpose: those are a statistic about the
  // office, this is news addressed to one person — and a reviewer reading an
  // office-wide dashboard is still an author of their own reports.
  //
  // reviewed_by is excluded when it is the reader. An Admin who decided on
  // their own report does not need to be told what they just did.
  const decidedQuery = supabase
    .from("reports")
    .select(
      "id, title, type, budget_period, status, period_month, period_year, reviewed_at, reviewer:profiles!reviewed_by(full_name)"
    )
    .eq("author_id", profile.id)
    .in("status", ["reviewed", "rejected"])
    .not("reviewed_at", "is", null)
    .neq("reviewed_by", profile.id)
    .order("reviewed_at", { ascending: false })
    .limit(6);

  const [
    total,
    submitted,
    reviewed,
    rejected,
    { data: recentData },
    { data: decidedData },
    departments,
  ] = await Promise.all([
    countBy(undefined, mineOnly),
    countBy("submitted", mineOnly),
    countBy("reviewed", mineOnly),
    countBy("rejected", mineOnly),
    recentQuery,
    decidedQuery,
    getDepartments(),
  ]);
  const recent = (recentData ?? []) as unknown as RecentReport[];

  // The four statuses are exhaustive, so whatever the three tracked ones do not
  // account for is still in draft.
  const drafts = Math.max(0, total - submitted - reviewed - rejected);
  const now = new Date();

  // `now` rather than a second clock read: two reads in one render can straddle
  // a boundary, and react-hooks/purity is right that a component should not be
  // asking the time twice anyway.
  const progress = progressFromDecisions(
    (decidedData ?? []) as unknown as DecidedReport[],
    now
  );

  // The one sentence under the title says what to do next, not where you are —
  // the title and the rail already say that. Each branch names the most urgent
  // thing in the reader's own pile, and the counts behind it are the ones in
  // the band directly below, so the sentence and the numbers never disagree.
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const headline = reviewer
    ? submitted > 0
      ? `${plural(submitted, "report is", "reports are")} waiting for a decision.`
      : "Nothing is waiting for a decision."
    : officeWide
      ? "Where the office's reports stand."
      : rejected > 0
        ? `${plural(rejected, "report was", "reports were")} sent back — edit and resubmit ${rejected === 1 ? "it" : "them"}.`
        : drafts > 0
          ? `${plural(drafts, "draft has", "drafts have")} not been submitted yet.`
          : "Everything you've filed is with a reviewer or done.";

  return (
    <div className="space-y-6">
      {/* Renders no element of its own until it opens, and opens into a portal,
          so it costs the space-y-6 stack below nothing. */}
      <ReportProgressDialog updates={progress} />
      {/* A page title, not a welcome card. The card spent a tile, an eyebrow
          and three chips on the month, the role and a count — the role is
          already in the top bar and the count is the band below — and pushed
          the page's actual work further down. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{headline}</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/reports/new">
            <Plus className="size-4" />
            New report
          </Link>
        </Button>
      </header>

      <StatusBand
        total={total}
        cells={[
          {
            label: "Awaiting review",
            caption: "Submitted, not yet decided",
            value: submitted,
            tone: "warning",
            href: "/reports?status=submitted",
          },
          {
            label: "Reviewed",
            caption: "Approved and counted",
            value: reviewed,
            tone: "good",
            href: "/reports?status=reviewed",
          },
          {
            label: "Rejected",
            caption: "Sent back for edits",
            value: rejected,
            tone: "critical",
            href: "/reports?status=rejected",
          },
          {
            label: "Draft",
            caption: "Started, not yet submitted",
            value: drafts,
            tone: "neutral",
            href: "/reports?status=draft",
          },
        ]}
      />

      {/* Directly under the numbers, because for a reviewer this list is the
          job. It used to sit below the whole annual budget — several thousand
          pixels of charts between "15 awaiting review" and the fifteen. */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-[17px] font-semibold">
              {reviewer ? "Waiting for a decision" : "Recent reports"}
            </CardTitle>
            <CardDescription>
              {reviewer
                ? "Newest first. Open one to read it and decide."
                : officeWide
                  ? "The most recently updated reports across the office."
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
                  : officeWide
                    ? "No reports in the office yet."
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
                            {officeWide && report.author
                              ? ` · ${report.author.full_name || report.author.email}`
                              : ""}
                          </span>
                          {/* Outside the truncating span so a long title never
                              clips the department off the row. */}
                          {officeWide && report.author ? (
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
                      {/* Every row in the queue is Submitted by definition, so a
                          column of identical badges would say nothing. When it
                          arrived is what tells a reviewer which to open first. */}
                      {reviewer ? (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {new Date(report.updated_at).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short" }
                          )}
                        </span>
                      ) : (
                        <StatusBadge status={report.status} />
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
