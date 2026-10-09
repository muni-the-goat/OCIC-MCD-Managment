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
import { DepartmentMonthMatrix } from "@/components/department-month-matrix";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { PrintPortal } from "@/components/print-portal";
import {
  PrintableAnnualBudget,
  type AnnualBudgetPrintItem,
} from "@/components/printable-annual-budget";
import {
  annualBudgetScope,
  canSetBudgetApproval,
  canViewAnnualBudget,
  canViewDepartmentMatrix,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { createClient } from "@/lib/supabase/server";
import { ChevronDown } from "lucide-react";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  itemTotal,
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
  // Admin, Coordinator and VP Assistant all reach every author, for different
  // reasons — one administers the office, one oversees its spend, one reads on
  // the VP's behalf — so the summary asks for the scope rather than the role.
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
  // One array feeds both the on-screen matrix and the print document, so the two
  // can never disagree. Typed as the richer print item (section/name kept) since
  // that is a superset of what the matrix reads.
  const matrixItems: AnnualBudgetPrintItem[] = showMatrix
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
    <>
    <Card className="rounded-[1.25rem] shadow-none ring-0">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="type-headline">
            Annual budget · FY {selectedYear}
          </CardTitle>
          <CardDescription className="type-callout">
            {seesEveryAuthor
              ? "Automatically combines all reviewed monthly budget reports across the office."
              : "Automatically combines only your reviewed monthly budget reports."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {showMatrix && sourceItems.length > 0 ? (
            <ExportPdfButton label="Export budget PDF" />
          ) : null}
          <SummaryFilters
            years={years}
            selectedYear={selectedYear}
            authors={authors}
            selectedAuthor={selectedAuthor}
            allAuthorsLabel="All authors"
          />
        </div>
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
                    className="font-heading text-[17px] font-semibold"
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
    {showMatrix && sourceItems.length > 0 ? (
      <PrintPortal>
        <PrintableAnnualBudget
          year={selectedYear}
          approval={approval}
          spent={totalSpend}
          items={matrixItems}
          departments={departments}
        />
      </PrintPortal>
    ) : null}
    </>
  );
}

const groupMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// Each author as a row that opens, rather than every author's full set of
// tiles and two charts stacked down the page. Five authors made five identical
// blocks and a page several thousand pixels long, and the reader had to scroll
// all of them to compare two totals. The row carries the two figures that
// answer "whose spend is this and how much" — the rest is one click away, and
// <details> brings keyboard, screen-reader and pre-hydration behaviour with it.
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
        <div className="space-y-1">
          <h3 className="font-heading text-[17px] font-semibold">
            Each author&apos;s expenses
          </h3>
          <p className="text-xs text-muted-foreground">
            Open an author to see their months and biggest line items.
          </p>
        </div>
      ) : null}
      <div className="divide-y overflow-hidden rounded-lg border">
        {groups.map((group) => {
          const total = group.items.reduce(
            (sum, item) => sum + itemTotal(item),
            0
          );
          const byMonth = MONTH_KEYS.map((key) =>
            group.items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0)
          );
          const peak = byMonth.indexOf(Math.max(...byMonth));
          return (
            <details
              key={group.id}
              // With one author there is nothing to choose between, so the
              // row starts open rather than asking for a click to see anything.
              open={groups.length === 1}
              className="group/author"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      id={`annual-budget-author-${group.id}`}
                      className="font-semibold"
                    >
                      {group.label}
                    </span>
                    {/* Beside the name: with several authors listed this is
                        the fastest way to tell two first names apart. */}
                    <DepartmentBadge label={group.department} />
                  </span>
                  {total > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      Highest in {MONTH_NAMES[peak]}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {groupMoney.format(total)}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open/author:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <section
                aria-labelledby={`annual-budget-author-${group.id}`}
                className="border-t bg-card p-4"
              >
                <p className="mb-4 text-xs text-muted-foreground">
                  Reviewed monthly expenses · FY {year}
                </p>
                <AnnualBudgetCharts items={group.items} year={year} />
              </section>
            </details>
          );
        })}
      </div>
    </div>
  );
}
