import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Trash2 } from "lucide-react";
import { CommentForm } from "@/components/comment-form";
import { DeleteReportButton } from "@/components/delete-report-button";
import { DepartmentBadge } from "@/components/department-badge";
import { ReviewControls } from "@/components/review-controls";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BudgetGrid } from "@/components/budget-grid";
import { deleteAttachment } from "../actions";
import {
  canDecideOnReport,
  canManageAnyReport,
  canMarkReviewed,
  canRejectReport,
  getProfile,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import {
  reportPeriodLabel,
  reportTypeLabel,
  taskTypeColor,
  taskTypeLabel,
  type BudgetItem,
  type Profile,
  type Report,
  type ReportAttachment,
  type ReportComment,
  type ReportTask,
} from "@/lib/types";

export const metadata = { title: "Report" };

const MONTHLY_SECTIONS = [
  ["summary", "Summary"],
  ["accomplishments", "Accomplishments"],
  ["challenges", "Challenges"],
  ["next_month_plan", "Next month plan"],
] as const;

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, profile] = await Promise.all([params, getProfile()]);
  const supabase = await createClient();

  const { data: reportData } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!reportData) notFound(); // also hit when RLS hides the row

  const report = reportData as Report;

  const [
    { data: itemsData },
    { data: commentsData },
    { data: attachmentsData },
    { data: profilesData },
    departments,
  ] = await Promise.all([
    report.type === "budget"
      ? supabase
          .from("budget_items")
          .select("*")
          .eq("report_id", id)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    supabase
      .from("report_comments")
      .select("*")
      .eq("report_id", id)
      .order("created_at"),
    supabase
      .from("report_attachments")
      .select("*")
      .eq("report_id", id)
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email, department"),
    getDepartments(),
  ]);

  const items = (itemsData ?? []) as BudgetItem[];
  const comments = (commentsData ?? []) as ReportComment[];
  const attachments = (attachmentsData ?? []) as ReportAttachment[];
  const people = new Map(
    (
      (profilesData ?? []) as Pick<
        Profile,
        "id" | "full_name" | "email" | "department"
      >[]
    ).map((p) => [p.id, p])
  );
  const nameOf = (userId: string | null) => {
    const person = userId ? people.get(userId) : undefined;
    return person ? person.full_name || person.email : "Unknown";
  };
  const departmentOf = (userId: string | null) =>
    userId ? (people.get(userId)?.department ?? null) : null;

  // content is jsonb — a report written before tasks existed simply has no key.
  const tasks = Array.isArray(report.content?.tasks)
    ? (report.content.tasks as ReportTask[])
    : [];

  const isAuthor = report.author_id === profile.id;
  const privileged = canManageAnyReport(profile.role);
  const canEdit = isAuthor || privileged;
  const canDelete = (isAuthor && report.status === "draft") || privileged;
  // A Coordinator's reach stops at budget reports plus their own, so the
  // controls have to ask about this report rather than about the role alone.
  const inReach = canDecideOnReport(profile.role, report.type, isAuthor);
  const canApprove = inReach && canMarkReviewed(profile.role);
  const canReject = inReach && canRejectReport(profile.role);
  // Self-review is permitted for every role that can decide at all.
  const canReview = (canApprove || canReject) && report.status === "submitted";

  return (
    <div
      className={report.type === "budget" ? "space-y-6" : "max-w-4xl space-y-6"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {report.title}
            </h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
            <span>
              {reportTypeLabel(report.type, report.budget_period)} report ·{" "}
              {reportPeriodLabel(
                report.type,
                report.period_month,
                report.period_year,
                report.budget_period
              )} · by {nameOf(report.author_id)}
            </span>
            <DepartmentBadge
              label={departmentLabel(departmentOf(report.author_id), departments)}
            />
          </p>
          {report.reviewed_by && report.reviewed_at ? (
            <p className="text-sm text-muted-foreground">
              Reviewed by {nameOf(report.reviewed_by)} on{" "}
              {new Date(report.reviewed_at).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/reports/${report.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canDelete ? <DeleteReportButton reportId={report.id} /> : null}
        </div>
      </div>

      {report.status === "rejected" && isAuthor ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          This report was rejected. Read the comments below, then edit and
          resubmit it.
        </div>
      ) : null}

      {report.type === "budget" ? (
        <Card>
          <CardHeader>
            <CardTitle>Actual expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetGrid
              items={items}
              budgetPeriod={report.budget_period}
              month={report.period_month}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold">
                Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}
              </h3>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks were listed on this report.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {tasks.map((task, index) => (
                    <li
                      key={index}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">{task.name}</span>
                      {/* The swatch echoes the dashboard's ring, but the type
                          name is spelled out beside it — colour never carries
                          the meaning on its own. */}
                      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: taskTypeColor(task.type) }}
                        />
                        {taskTypeLabel(task.type)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {MONTHLY_SECTIONS.map(([key, label]) => (
              <div key={key}>
                <h3 className="mb-1 text-sm font-semibold">{label}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {report.content[key]?.trim() || "—"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="truncate">{attachment.file_name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="gap-2">
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-4" />
                        Download
                      </a>
                    </Button>
                    {canEdit ? (
                      <form action={deleteAttachment}>
                        <input
                          type="hidden"
                          name="attachment_id"
                          value={attachment.id}
                        />
                        <input
                          type="hidden"
                          name="report_id"
                          value={report.id}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`Delete ${attachment.file_name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canReview ? (
        <ReviewControls
          reportId={report.id}
          canMarkReviewed={canApprove}
          canReject={canReject}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-md border p-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {nameOf(comment.author_id)}
                    </span>{" "}
                    · {new Date(comment.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <CommentForm reportId={report.id} />
        </CardContent>
      </Card>
    </div>
  );
}
