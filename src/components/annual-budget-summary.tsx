import { AnnualBudgetFilters } from "@/components/annual-budget-filters";
import { BudgetGrid } from "@/components/budget-grid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canViewAnnualBudget } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  MONTH_KEYS,
  type AppRole,
  type BudgetItem,
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
  } else if (isHeadOfDepartment) {
    itemQuery = itemQuery.in(
      "report.author_id",
      authors.length > 0
        ? authors.map((profile) => profile.id)
        : ["00000000-0000-0000-0000-000000000000"]
    );
  } else if (!isAdmin) {
    itemQuery = itemQuery.eq("report.author_id", userId);
  }

  let yearQuery = supabase
    .from("reports")
    .select("period_year")
    .eq("type", "budget")
    .eq("budget_period", "monthly")
    .eq("status", "reviewed")
    .limit(1000);
  if (isHeadOfDepartment) {
    yearQuery = yearQuery.in(
      "author_id",
      authors.length > 0
        ? authors.map((profile) => profile.id)
        : ["00000000-0000-0000-0000-000000000000"]
    );
  } else if (!isAdmin) {
    yearQuery = yearQuery.eq("author_id", userId);
  }

  const [itemsResult, yearsResult] = await Promise.all([
    itemQuery,
    yearQuery,
  ]);

  const years = Array.from(
    new Set([
      selectedYear,
      ...(yearsResult.data ?? []).map((report) => report.period_year),
    ])
  ).sort((a, b) => b - a);
  const items = aggregateItems(
    (itemsResult.data ?? []) as unknown as SourceBudgetItem[]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Annual budget summary · FY {selectedYear}</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Automatically combines all reviewed monthly budget reports across the office."
              : isHeadOfDepartment
                ? "Automatically combines reviewed monthly budget reports submitted by Managers."
                : "Automatically combines only your reviewed monthly budget reports."}
          </CardDescription>
        </div>
        <AnnualBudgetFilters
          years={years}
          selectedYear={selectedYear}
          authors={authors}
          selectedAuthor={selectedAuthor}
          allAuthorsLabel={
            isHeadOfDepartment ? "All managers" : "All authors"
          }
        />
      </CardHeader>
      <CardContent>
        {itemsResult.error || yearsResult.error || authorsResult.error ? (
          <p className="text-sm text-destructive">
            The annual budget summary could not be loaded. Refresh to try
            again.
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reviewed monthly budget reports are available for this
            selection.
          </p>
        ) : (
          <BudgetGrid items={items} />
        )}
      </CardContent>
    </Card>
  );
}

export function AnnualBudgetSummarySkeleton() {
  return (
    <Card className="min-h-72">
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
