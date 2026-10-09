import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { CommentForm } from "@/components/comment-form";
import { DeleteAttachmentButton } from "@/components/delete-attachment-button";
import { DeleteReportButton } from "@/components/delete-report-button";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { PrintableBudgetReport } from "@/components/printable-budget-report";
import { PrintPortal } from "@/components/print-portal";
import { ReportSubmittedDialog } from "@/components/report-submitted-dialog";
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
import {
  canManageAnyReport,
  canMarkReviewed,
  canRejectReport,
  getProfile,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { RichText } from "@/components/rich-text";
import { isRichTextEmpty } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import {
  MONTHLY_SECTIONS,
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetItem,
  type Profile,
  type Report,
  type ReportAttachment,
  type ReportComment,
} from "@/lib/types";

export const metadata = { title: "Report" };

// The redesigned pages' surface: white on the ivory page with no ring, the
// fill difference being the edge.
const SURFACE = "rounded-[1.25rem] shadow-none ring-0";

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([
    params,
    searchParams,
    getProfile(),
  ]);
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

  const isAuthor = report.author_id === profile.id;
  const privileged = canManageAnyReport(profile.role);
  const canEdit = isAuthor || privileged;
  const canDelete = (isAuthor && report.status === "draft") || privileged;
  // Every reviewer reaches every report since 0029, so which decision a role
  // may make is the whole of the question. A Coordinator can approve and still
  // cannot reject.
  const canApprove = canMarkReviewed(profile.role);
  const canReject = canRejectReport(profile.role);
  // Self-review is permitted for every role that can decide at all.
  const canReview = (canApprove || canReject) && report.status === "submitted";
  // Three conditions, not one. The flag alone is a query string anybody can
  // type, so the report has to actually be submitted, and it has to be theirs —
  // a reviewer landing on this URL should not be congratulated on someone
  // else's work.
  const filledSections = MONTHLY_SECTIONS.filter(
    ({ key }) => !isRichTextEmpty(report.content?.[key])
  );
  const blankSections = MONTHLY_SECTIONS.filter(
    ({ key }) => isRichTextEmpty(report.content?.[key])
  );
  const justSubmitted =
    query.submitted === "1" && isAuthor && report.status === "submitted";

  return (
    // Centred like the dashboard and the list. An activity report is prose
    // and gets a reading width; a budget report carries a twelve-month grid
    // and gets the full column.
    <div
      className={`mx-auto w-full space-y-8 ${report.type === "budget" ? "max-w-6xl" : "max-w-4xl"}`}
    >
      {justSubmitted ? <ReportSubmittedDialog locked={!privileged} /> : null}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          {/* What kind of report and which month, above the title, the way
              the dashboard puts its reader's name above "Dashboard". */}
          <p className="type-eyebrow">
            {reportTypeLabel(report.type, report.budget_period)} report ·{" "}
            {reportPeriodLabel(
              report.type,
              report.period_month,
              report.period_year,
              report.budget_period
            )}
          </p>
          <h1 className="type-title text-balance">{report.title}</h1>
          <div className="type-subtitle flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={report.status} variant="pill" />
            <span>
              By {nameOf(report.author_id)}
              {departmentLabel(departmentOf(report.author_id), departments)
                ? ` · ${departmentLabel(departmentOf(report.author_id), departments)}`
                : ""}
            </span>
          </div>
          {report.reviewed_by && report.reviewed_at ? (
            <p className="type-callout text-muted-foreground">
              Reviewed by {nameOf(report.reviewed_by)} on{" "}
              {new Date(report.reviewed_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
        {/* The page's own actions as pills, sized here rather than in each
            component: Export and Delete are shared with other pages that keep
            their current buttons. Their dialogs portal out of this box, so the
            sizing never reaches the buttons inside them. */}
        <div className="flex flex-wrap gap-2 [&_[data-slot=button]]:h-10 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]]:border-transparent [&_[data-slot=button]]:bg-card [&_[data-slot=button]]:px-4 [&_[data-slot=button]]:text-[0.9375rem] [&_[data-slot=button]]:shadow-none">
          {report.type === "budget" ? <ExportPdfButton /> : null}
          {canEdit ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/reports/${report.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canDelete ? <DeleteReportButton reportId={report.id} /> : null}
        </div>
      </header>

      {report.type === "budget" ? (
        <PrintPortal>
          <PrintableBudgetReport
            report={report}
            items={items}
            authorName={nameOf(report.author_id)}
            departmentName={
              departmentLabel(departmentOf(report.author_id), departments) ??
              "Unassigned"
            }
          />
        </PrintPortal>
      ) : null}

      {report.status === "rejected" && isAuthor ? (
        <div className="type-callout rounded-[1.25rem] bg-status-critical/10 p-5 text-foreground">
          <p className="font-semibold">This report was sent back.</p>
          <p className="mt-1 text-muted-foreground">
            Read the comments below, then edit and resubmit it.
          </p>
        </div>
      ) : null}

      {/* The decision sits beside the status it changes, at the top, rather
          than under the whole report and its attachments. A reviewer opened
          this page to decide; the first screen should say so and hold the
          controls, and the report reads below it. */}
      {canReview ? (
        <ReviewControls
          reportId={report.id}
          canMarkReviewed={canApprove}
          canReject={canReject}
        />
      ) : null}

      {report.type === "budget" ? (
        <Card className={SURFACE}>
          <CardHeader>
            <CardTitle className="type-headline">Actual expenses</CardTitle>
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
        // No "Report" heading over the report: the page title already is one.
        // Sections the author left blank are named once at the foot instead of
        // each printing its heading over a lone dash — half a page of "—" on a
        // typical report, and the reader had to scan every one to learn that
        // nothing was there.
        <Card className={SURFACE}>
          <CardContent className="space-y-8">
            {filledSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every section of this report is blank.
              </p>
            ) : (
              filledSections.map(({ key, label }) => (
                <section key={key}>
                  <h2 className="mb-2 font-heading text-[1.25rem] leading-tight font-semibold tracking-[-0.012em]">
                    {label}
                  </h2>
                  {/* Body size, like the rest of the redesigned pages. The
                      report is the thing being read here, and it was set at
                      14px in grey — smaller and fainter than its own chrome. */}
                  <RichText
                    value={report.content[key]}
                    className="text-[1.0625rem] leading-[1.55] text-foreground/85"
                  />
                </section>
              ))
            )}
            {blankSections.length > 0 && filledSections.length > 0 ? (
              <p className="type-callout border-t pt-5 text-muted-foreground">
                Left blank:{" "}
                {blankSections.map(({ label }) => label).join(", ")}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className="type-headline">Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="type-callout text-muted-foreground">No attachments.</p>
          ) : (
            <ul className="-mx-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="type-callout flex min-h-12 items-center justify-between gap-2 rounded-xl px-2 hover:bg-muted/50 [&+li]:mt-1"
                >
                  <span className="truncate font-medium">
                    {attachment.file_name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      className="h-9 gap-2 rounded-full px-3"
                    >
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
                      <DeleteAttachmentButton
                        attachmentId={attachment.id}
                        reportId={report.id}
                        fileName={attachment.file_name}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle className="type-headline">Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="type-callout text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-2xl bg-muted/50 p-4">
                  <p className="type-caption mb-1 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {nameOf(comment.author_id)}
                    </span>{" "}
                    · {new Date(comment.created_at).toLocaleString()}
                  </p>
                  <p className="type-callout whitespace-pre-wrap">
                    {comment.body}
                  </p>
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
