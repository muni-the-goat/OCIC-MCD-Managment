import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Trash2 } from "lucide-react";
import { CommentForm } from "@/components/comment-form";
import { DeleteReportButton } from "@/components/delete-report-button";
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
import { getProfile, isReviewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetItem,
  type Profile,
  type Report,
  type ReportAttachment,
  type ReportComment,
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
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const items = (itemsData ?? []) as BudgetItem[];
  const comments = (commentsData ?? []) as ReportComment[];
  const attachments = (attachmentsData ?? []) as ReportAttachment[];
  const people = new Map(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name || p.email]
    )
  );
  const nameOf = (userId: string | null) =>
    (userId && people.get(userId)) || "Unknown";

  const isAuthor = report.author_id === profile.id;
  const canEdit =
    (isAuthor && (report.status === "draft" || report.status === "rejected")) ||
    profile.role === "admin";
  const canDelete =
    (isAuthor && report.status === "draft") || profile.role === "admin";
  const canReview =
    isReviewer(profile.role) && report.status === "submitted" && !isAuthor;

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
          <p className="text-sm text-muted-foreground">
            {reportTypeLabel(report.type, report.budget_period)} report ·{" "}
            {reportPeriodLabel(
              report.type,
              report.period_month,
              report.period_year,
              report.budget_period
            )} · by{" "}
            {nameOf(report.author_id)}
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

      {canReview ? <ReviewControls reportId={report.id} /> : null}

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
