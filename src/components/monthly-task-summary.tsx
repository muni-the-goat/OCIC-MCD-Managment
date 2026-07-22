import {
  MonthlyTaskCharts,
  type TaskEntry,
} from "@/components/monthly-task-charts";
import { SummaryFilters } from "@/components/summary-filters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  MONTH_NAMES,
  TASK_TYPE_IDS,
  type AppRole,
  type MonthlyContent,
  type TaskType,
} from "@/lib/types";

interface SourceReport {
  id: string;
  author_id: string;
  period_month: number;
  content: MonthlyContent | null;
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

// `content` is jsonb, so a report written before tasks existed — or edited by
// hand — can hold anything. Read it defensively and drop what does not fit the
// taxonomy rather than letting an unknown type fall out of the chart's colours.
function taskEntries(reports: SourceReport[]): TaskEntry[] {
  const entries: TaskEntry[] = [];

  for (const report of reports) {
    const tasks = report.content?.tasks;
    if (!Array.isArray(tasks)) continue;

    for (const task of tasks) {
      const { name, type } = (task ?? {}) as { name?: string; type?: string };
      if (typeof type !== "string") continue;
      entries.push({
        name: typeof name === "string" && name.trim() ? name.trim() : "Untitled",
        type: (TASK_TYPE_IDS.includes(type as TaskType)
          ? type
          : "other") as TaskType,
      });
    }
  }

  return entries;
}

export async function MonthlyTaskSummary({
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

  // Reviewed only, exactly like the budget tab: a task mix is only worth
  // charting once someone has signed off on the reports behind it.
  let reportQuery = supabase
    .from("reports")
    .select("id, author_id, period_month, content")
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
  const entries = taskEntries(monthReports);

  // The year's shape, for the trend line and the month-over-month delta. `null`
  // where no reviewed report exists rather than 0 — a month nobody has written
  // up yet is unknown, not a month in which no work was done, and a line drawn
  // through it would state something the data does not support.
  const trend = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const reportsInMonth = reports.filter(
      (report) => report.period_month === monthNumber
    );
    return reportsInMonth.length === 0
      ? null
      : taskEntries(reportsInMonth).length;
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reviewed activity
          </p>
          <CardTitle>
            Monthly report summary · {MONTH_NAMES[selectedMonth - 1]}{" "}
            {selectedYear}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "How many tasks were completed across the office this month, and what kind of work they were."
              : isHeadOfDepartment
                ? "How many tasks Managers completed this month, and what kind of work they were."
                : "How many tasks you completed this month, and what kind of work they were."}
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
          idPrefix="monthly-task"
        />
      </CardHeader>
      <CardContent>
        {reportsResult.error || yearsResult.error || authorsResult.error ? (
          <p className="text-sm text-destructive">
            The monthly report summary could not be loaded. Refresh to try
            again.
          </p>
        ) : (
          <MonthlyTaskCharts
            entries={entries}
            trend={trend}
            reportCount={monthReports.length}
            month={selectedMonth}
            year={selectedYear}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function MonthlyTaskSummarySkeleton() {
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
