import type { BudgetPeriod, ReportType } from "@/lib/types";

// What the dashboard tells an author on arrival about their own reports.
//
// The rules live here rather than in the dialog because they are the whole of
// the feature: which decisions are still worth mentioning, which order they go
// in, and what the heading says about them. The component is then only markup.

// An approval goes stale. Being told in September that August was approved is
// not news, it is a reminder of something that was acted on weeks ago.
//
// A rejection never goes stale, and there is deliberately no equivalent cutoff
// for one: it is work still waiting to be done, so it keeps appearing on every
// visit until the author edits the report and sends it back. That is a nag by
// design — the alternative is a report that was rejected in July and quietly
// forgotten by everyone including the system.
export const APPROVAL_IS_NEWS_FOR_DAYS = 14;

// A decision as it comes back from PostgREST, database naming and all.
export interface DecidedReport {
  id: string;
  title: string;
  type: ReportType;
  budget_period: BudgetPeriod;
  status: "reviewed" | "rejected";
  period_month: number;
  period_year: number;
  reviewed_at: string;
  reviewer: { full_name: string } | null;
}

// The same decision once it is fit to put in front of someone.
export interface ReportProgress {
  id: string;
  title: string;
  type: ReportType;
  budgetPeriod: BudgetPeriod;
  status: "reviewed" | "rejected";
  month: number;
  year: number;
  decidedBy: string;
}

// `rows` arrive newest decision first. The sort is stable in every engine this
// runs on, so grouping rejections to the top keeps recency inside each group
// without a second comparison.
export function progressFromDecisions(
  rows: DecidedReport[],
  now: Date
): ReportProgress[] {
  const staleBefore =
    now.getTime() - APPROVAL_IS_NEWS_FOR_DAYS * 24 * 60 * 60 * 1000;

  return rows
    .filter(
      (row) =>
        row.status === "rejected" || Date.parse(row.reviewed_at) >= staleBefore
    )
    .sort(
      (a, b) =>
        Number(b.status === "rejected") - Number(a.status === "rejected")
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      budgetPeriod: row.budget_period,
      status: row.status,
      month: row.period_month,
      year: row.period_year,
      // Null only because the reviewer's profile could be deleted out from
      // under a decision that still stands.
      decidedBy: row.reviewer?.full_name || "a reviewer",
    }));
}

// A rejection outranks an approval in the heading even when both are in the
// list, because one of them is work waiting to be done and the other is not.
// Someone with two approvals and one rejection needs to be told about the
// rejection; the approvals are the pleasant part of the same sentence.
export function summaryCopy(updates: ReportProgress[]) {
  const sentBack = updates.filter((row) => row.status === "rejected").length;

  if (sentBack > 0) {
    return {
      tone: "sent-back" as const,
      title:
        sentBack === 1
          ? "A report has been sent back to you"
          : `${sentBack} reports have been sent back to you`,
      description:
        sentBack === 1
          ? "Open it to read the comments explaining why, then edit it and submit it again."
          : "Open each one to read the comments explaining why, then edit and submit them again.",
    };
  }

  return {
    tone: "approved" as const,
    title:
      updates.length === 1
        ? "Your report was approved"
        : "Your reports were approved",
    description:
      updates.length === 1
        ? "Nothing to do — it has been counted."
        : "Nothing to do — they have been counted.",
  };
}
