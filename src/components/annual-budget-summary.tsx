import { AnnualBudgetCharts } from "@/components/annual-budget-charts";
import { SummaryFilters } from "@/components/summary-filters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BudgetApprovalBar } from "@/components/budget-approval-bar";
import { DepartmentBadge } from "@/components/department-badge";
import {
  DepartmentMonthMatrix,
  type DepartmentMatrixItem,
} from "@/components/department-month-matrix";
import {
  annualBudgetScope,
  canSetBudgetApproval,
  canViewAnnualBudget,
  canViewDepartmentMatrix,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import {
  MONTH_KEYS,
  type AppRole,
  type BudgetItem,
  type Department,
  type MonthKey,
} from "@/lib/types";

interface SourceBudgetItem extends BudgetItem {
  report: {
    author_id: string;
    period_month: number;
    period_year: number;
  };
}

function aggregateItems(items: SourceBudgetItem[]): BudgetItem[] {
  const grouped = new Map<string, BudgetItem>();

  for (const item of items) {
    const section = item.section.trim();
    const name = item.name.trim();
    const key = `${section.toLocaleLowerCase()}\u0000${name.toLocaleLowerCase()}`;
    let aggregate = grouped.get(key);

    if (!aggregate) {
      aggregate = {
        id: key,
        report_id: "annual-dashboard",
        section,
        name,
        sort_order: 0,
        ...Object.fromEntries(MONTH_KEYS.map((month) => [month, 0])),
      } as BudgetItem;
      grouped.set(key, aggregate);
    }

    for (const month of MONTH_KEYS) {
      aggregate[month as MonthKey] += Number(item[month] ?? 0);
    }
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) || a.name.localeCompare(b.name)
    )
    .map((item, index) => ({ ...item, sort_order: index }));
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

export async function AnnualBudgetSummary({
  userId,
  role,
  year,
  author,
}: {
  userId: string;
  role: AppRole;
  year?: string;
  author?: string;
}) {
  if (!canViewAnnualBudget(role)) return null;

  const supabase = await createClient();
  // Admin and Coordinator both reach every author, for different reasons — one
  // administers the office, the other oversees its spend — so the summary asks
  // for the scope rather than for the role.
  const scope = annualBudgetScope(role);
  const seesEveryAuthor = scope === "all";
  const canFilterAuthors = seesEveryAuthor;
  const selectedYear = validYear(year);

  const authorsResult = canFilterAuthors
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, role, department")
        .order("full_name")
    : { data: [], error: null };

  const authors = (authorsResult.data ?? []).map((profile) => ({
    id: profile.id,
    label: profile.full_name || profile.email,
    department: (profile.department ?? null) as Department | null,
  }));
  const permittedAuthorIds = new Set(authors.map((profile) => profile.id));
  const selectedAuthor =
    canFilterAuthors &&
    validUuid(author) &&
    permittedAuthorIds.has(author as string)
      ? author
      : undefined;

  let itemQuery = supabase
    .from("budget_items")
    .select(
      "*, report:reports!inner(author_id, period_month, period_year, type, budget_period, status)"
    )
    .eq("report.type", "budget")
    .eq("report.budget_period", "monthly")
    .eq("report.status", "reviewed")
    .eq("report.period_year", selectedYear)
    .order("sort_order")
    .limit(5000);

  if (selectedAuthor) {
    itemQuery = itemQuery.eq("report.author_id", selectedAuthor);
  } else if (!seesEveryAuthor) {
    itemQuery = itemQuery.eq("report.author_id", userId);
  }

  let yearQuery = supabase
    .from("reports")
    .select("period_year")
    .eq("type", "budget")
    .eq("budget_period", "monthly")
    .eq("status", "reviewed")
    .limit(1000);
  if (!seesEveryAuthor) {
    yearQuery = yearQuery.eq("author_id", userId);
  }

  const [itemsResult, yearsResult, departments, approvalResult] =
    await Promise.all([
      itemQuery,
      yearQuery,
      getDepartments(),
      supabase
        .from("budget_approvals")
        .select("amount")
        .eq("year", selectedYear)
        .maybeSingle(),
    ]);
  const approval =
    approvalResult.data?.amount != null
      ? Number(approvalResult.data.amount)
      : null;

  const years = Array.from(
    new Set([
      selectedYear,
      ...(yearsResult.data ?? []).map((report) => report.period_year),
    ])
  ).sort((a, b) => b - a);
  const sourceItems = (itemsResult.data ?? []) as unknown as SourceBudgetItem[];
  const showAuthorGroups = canFilterAuthors && !selectedAuthor;
  const authorProfiles = new Map(
    authors.map((profile) => [profile.id, profile])
  );
  const groupedSourceItems = new Map<string, SourceBudgetItem[]>();

  if (showAuthorGroups) {
    for (const item of sourceItems) {
      const authorItems = groupedSourceItems.get(item.report.author_id) ?? [];
      authorItems.push(item);
      groupedSourceItems.set(item.report.author_id, authorItems);
    }
  }

  // The matrix is built from the items already fetched above, not from a second
  // query — which is also what guarantees it reconciles with the grids beneath
  // it. Same scope, same year, same author filter, one source of numbers.
  const showMatrix = canViewDepartmentMatrix(role);
  const matrixItems: DepartmentMatrixItem[] = showMatrix
    ? sourceItems.map((item) => ({
        ...item,
        department: authorProfiles.get(item.report.author_id)?.department ?? null,
      }))
    : [];

  const authorGroups = [...groupedSourceItems.entries()]
    .map(([authorId, authorItems]) => ({
      id: authorId,
      label: authorProfiles.get(authorId)?.label ?? "Unknown author",
      department: departmentLabel(
        authorProfiles.get(authorId)?.department,
        departments
      ),
      items: aggregateItems(authorItems),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const items = showAuthorGroups ? [] : aggregateItems(sourceItems);
  // The same numbers the matrix totals, so the bar above it and the Total row
  // inside it can never disagree.
  const totalSpend = matrixItems.reduce(
    (sum, item) =>
      sum + MONTH_KEYS.reduce((row, key) => row + Number(item[key] ?? 0), 0),
    0
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reviewed expenses
          </p>
          <CardTitle>Annual budget summary · FY {selectedYear}</CardTitle>
          <CardDescription>
            {seesEveryAuthor
              ? "Automatically combines all reviewed monthly budget reports across the office."
              : "Automatically combines only your reviewed monthly budget reports."}
          </CardDescription>
        </div>
        <SummaryFilters
          years={years}
          selectedYear={selectedYear}
          authors={authors}
          selectedAuthor={selectedAuthor}
          allAuthorsLabel="All authors"
        />
      </CardHeader>
      <CardContent>
        {itemsResult.error || yearsResult.error || authorsResult.error ? (
          <p className="text-sm text-destructive">
            The annual budget summary could not be loaded. Refresh to try
            again.
          </p>
        ) : sourceItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reviewed monthly budget reports are available for this
            selection.
          </p>
        ) : (
          <div className="space-y-6">
            {showMatrix ? (
              <section
                aria-labelledby="annual-budget-department-matrix"
                className="space-y-3"
              >
                <div className="space-y-1">
                  <h3
                    id="annual-budget-department-matrix"
                    className="font-heading text-base font-semibold"
                  >
                    Spend by department and month
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Every reviewed monthly budget for FY {selectedYear}, placed
                    in the department of the person who filed it.
                    {showAuthorGroups
                      ? " Totals here match the per-author breakdowns below."
                      : ""}
                  </p>
                </div>
                <BudgetApprovalBar
                  year={selectedYear}
                  approval={approval}
                  spent={totalSpend}
                  canEdit={canSetBudgetApproval(role)}
                />
                <DepartmentMonthMatrix
                  items={matrixItems}
                  departments={departments}
                  year={selectedYear}
                  approval={approval}
                />
              </section>
            ) : null}
            {showAuthorGroups ? (
              <AuthorGroups
                groups={authorGroups}
                year={selectedYear}
                separated={showMatrix}
              />
            ) : (
              <AnnualBudgetCharts items={items} year={selectedYear} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuthorGroups({
  groups,
  year,
  separated,
}: {
  groups: {
    id: string;
    label: string;
    department: string | null;
    items: BudgetItem[];
  }[];
  year: number;
  // The matrix above is already an office-wide roll-up, so the per-author grids
  // need a heading that says what changed, not just more cards.
  separated: boolean;
}) {
  return (
    <div className="space-y-3">
      {separated ? (
        <h3 className="font-heading text-base font-semibold">
          Each author&apos;s expenses
        </h3>
      ) : null}
      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`annual-budget-author-${group.id}`}
            className="overflow-hidden rounded-lg border"
          >
            <div className="border-b bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h4
                  id={`annual-budget-author-${group.id}`}
                  className="font-semibold"
                >
                  {group.label}
                </h4>
                {/* Beside the name rather than in the sub-line below: with
                    several authors stacked this is the fastest way to tell
                    whose figures these are when two share a first name. */}
                <DepartmentBadge label={group.department} />
              </div>
              <p className="text-xs text-muted-foreground">
                Reviewed monthly expenses · FY {year}
              </p>
            </div>
            <div className="p-4">
              <AnnualBudgetCharts items={group.items} year={year} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function AnnualBudgetSummarySkeleton() {
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
