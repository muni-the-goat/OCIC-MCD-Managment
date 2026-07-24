import { Download, Paperclip } from "lucide-react";
import Link from "next/link";
import { DepartmentBadge } from "@/components/department-badge";
import { SummaryFilters } from "@/components/summary-filters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import {
  MONTH_NAMES,
  type AppRole,
  type MonthlyContent,
  type Profile,
} from "@/lib/types";

// The four narrative sections, in the order the form asks for them. The detail
// page keeps its own copy of this list; both exist because the two read the
// same jsonb but lay it out differently.
const SECTIONS = [
  ["summary", "Summary"],
  ["accomplishments", "Accomplishments"],
  ["challenges", "Challenges"],
  ["next_month_plan", "Next month plan"],
] as const satisfies readonly (readonly [keyof MonthlyContent, string])[];

interface SourceReport {
  id: string;
  author_id: string;
  title: string;
  period_month: number;
  content: MonthlyContent | null;
}

interface SourceAttachment {
  id: string;
  report_id: string;
  file_name: string;
}

function validYear(value?: string) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : new Date().getFullYear();
}

function validUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function validMonth(value?: string) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : undefined;
}

export async function MonthlyActivitySummary({
  userId,
  role,
  year,
  month,
  author,
}: {
  userId: string;
  role: AppRole;
  year?: string;
  month?: string;
  author?: string;
}) {
  const supabase = await createClient();
  const isAdmin = role === "admin";
  const isHeadOfDepartment = role === "head_of_department";
  const canFilterAuthors = isAdmin || isHeadOfDepartment;
  const selectedYear = validYear(year);

  const authorsResult = canFilterAuthors
    ? await (() => {
        let query = supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .order("full_name");
        if (isHeadOfDepartment) query = query.eq("role", "manager");
        return query;
      })()
    : { data: [], error: null };

  const authors = (authorsResult.data ?? []).map((profile) => ({
    id: profile.id,
    label: profile.full_name || profile.email,
  }));
  const permittedAuthorIds = new Set(authors.map((profile) => profile.id));
  const selectedAuthor =
    canFilterAuthors &&
    validUuid(author) &&
    permittedAuthorIds.has(author as string)
      ? author
      : undefined;

  // Reviewed only, exactly like the budget tab: what is shown here has been
  // signed off, so a draft in progress never surfaces on someone else's
  // dashboard.
  let reportQuery = supabase
    .from("reports")
    .select("id, author_id, title, period_month, content")
    .eq("type", "monthly")
    .eq("status", "reviewed")
    .eq("period_year", selectedYear)
    .order("period_month")
    .limit(2000);

  let yearQuery = supabase
    .from("reports")
    .select("period_year")
    .eq("type", "monthly")
    .eq("status", "reviewed")
    .limit(1000);

  const scopedAuthorIds = isHeadOfDepartment
    ? authors.length > 0
      ? authors.map((profile) => profile.id)
      : ["00000000-0000-0000-0000-000000000000"]
    : null;

  if (selectedAuthor) {
    reportQuery = reportQuery.eq("author_id", selectedAuthor);
  } else if (scopedAuthorIds) {
    reportQuery = reportQuery.in("author_id", scopedAuthorIds);
  } else if (!isAdmin) {
    reportQuery = reportQuery.eq("author_id", userId);
  }

  if (scopedAuthorIds) {
    yearQuery = yearQuery.in("author_id", scopedAuthorIds);
  } else if (!isAdmin) {
    yearQuery = yearQuery.eq("author_id", userId);
  }

  const [reportsResult, yearsResult] = await Promise.all([
    reportQuery,
    yearQuery,
  ]);

  const years = Array.from(
    new Set([
      selectedYear,
      ...(yearsResult.data ?? []).map((report) => report.period_year),
    ])
  ).sort((a, b) => b - a);
  const reports = (reportsResult.data ?? []) as unknown as SourceReport[];

  // The whole year is fetched in one query and narrowed here, which is what
  // makes the month list free: offering a month with no report behind it would
  // be a dead end, so only months that actually have one are listed.
  const now = new Date();
  const currentMonth =
    selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
  const months = Array.from(
    new Set(reports.map((report) => report.period_month))
  )
    .filter((value) => value >= 1 && value <= 12)
    .sort((a, b) => a - b);
  const requestedMonth = validMonth(month);
  // An explicit month is honoured even when empty, so the picker never fights
  // the reader. Without one, land on the newest month that has a report — an
  // empty card in July helps nobody when April is the last month written up.
  const selectedMonth =
    requestedMonth ?? months[months.length - 1] ?? currentMonth;
  const monthOptions = months.includes(selectedMonth)
    ? months
    : [...months, selectedMonth].sort((a, b) => a - b);

  const monthReports = reports.filter(
    (report) => report.period_month === selectedMonth
  );

  // Attachments and author names are fetched only for the month on screen —
  // the year's other eleven months are already in memory for the month picker,
  // but nothing about them is rendered.
  const reportIds = monthReports.map((report) => report.id);
  const authorIds = Array.from(
    new Set(monthReports.map((report) => report.author_id))
  );
  const [attachmentsResult, peopleResult, departments] = await Promise.all([
    reportIds.length > 0
      ? supabase
          .from("report_attachments")
          .select("id, report_id, file_name")
          .in("report_id", reportIds)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    authorIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, department")
          .in("id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    getDepartments(),
  ]);

  const attachments = (attachmentsResult.data ?? []) as SourceAttachment[];
  const byReport = new Map<string, SourceAttachment[]>();
  for (const attachment of attachments) {
    const list = byReport.get(attachment.report_id) ?? [];
    list.push(attachment);
    byReport.set(attachment.report_id, list);
  }

  const people = new Map(
    (
      (peopleResult.data ?? []) as Pick<
        Profile,
        "id" | "full_name" | "email" | "department"
      >[]
    ).map((person) => [
      person.id,
      {
        name: person.full_name || person.email,
        department: departmentLabel(person.department, departments),
      },
    ])
  );

  const failed =
    reportsResult.error ||
    yearsResult.error ||
    authorsResult.error ||
    attachmentsResult.error ||
    peopleResult.error;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reviewed activity
          </p>
          <CardTitle>
            Monthly activity · {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "What each team reported this month, and the documents they filed with it."
              : isHeadOfDepartment
                ? "What each Manager reported this month, and the documents they filed with it."
                : "What you reported this month, and the documents you filed with it."}
          </CardDescription>
        </div>
        <SummaryFilters
          years={years}
          selectedYear={selectedYear}
          months={monthOptions}
          selectedMonth={selectedMonth}
          authors={authors}
          selectedAuthor={selectedAuthor}
          allAuthorsLabel={isHeadOfDepartment ? "All managers" : "All authors"}
          yearParam="task_year"
          monthParam="task_month"
          authorParam="task_author"
          idPrefix="monthly-activity"
        />
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="text-sm text-destructive">
            The monthly activity summary could not be loaded. Refresh to try
            again.
          </p>
        ) : monthReports.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reviewed monthly activity reports for{" "}
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
          </p>
        ) : (
          <ul className="space-y-4">
            {monthReports.map((report) => {
              const files = byReport.get(report.id) ?? [];
              const author = people.get(report.author_id);
              return (
                <li key={report.id} className="rounded-xl border p-4">
                  {/* Who filed it leads, because that is what a reviewer scans
                      by — the title repeats the month they already picked. */}
                  <div className="mb-3 border-b pb-3">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-heading text-base font-semibold">
                        {author?.name ?? "Unknown"}
                      </span>
                      <DepartmentBadge label={author?.department ?? null} />
                    </div>
                    <Link
                      href={`/reports/${report.id}`}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {report.title}
                    </Link>
                  </div>

                  <dl className="space-y-2.5">
                    {SECTIONS.map(([key, label]) => (
                      <div key={key}>
                        <dt className="text-xs font-semibold">{label}</dt>
                        <dd className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {report.content?.[key]?.trim() || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* The documents are the point of the report now, so they sit
                      below the narrative rather than on the detail page alone. */}
                  <div className="mt-3 border-t pt-3">
                    {files.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        No documents attached.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {files.map((file) => (
                          <li key={file.id}>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-8 max-w-full gap-1.5"
                            >
                              <a
                                href={`/api/attachments/${file.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="size-3.5" />
                                <span className="truncate">
                                  {file.file_name}
                                </span>
                              </a>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MonthlyActivitySummarySkeleton() {
  return (
    <Card className="min-h-72 rounded-2xl">
      <CardHeader>
        <div className="h-6 w-64 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-40 rounded-lg bg-muted/60 motion-safe:animate-pulse" />
      </CardContent>
    </Card>
  );
}
