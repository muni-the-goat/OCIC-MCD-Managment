import {
  MONTH_KEYS,
  UNIT_KEYS,
  isReportedMonth,
  itemTotal,
  itemUnitTotal,
  type MonthlyAmounts,
  PROJECT_CATEGORIES,
  UNASSIGNED_CATEGORY,
  type MonthlyUnits,
  type ProjectReportItem,
} from "@/lib/types";

// Pure aggregation over a project report's rows. No server import, so the
// dashboard cards and any future client-side filter can ask the same questions
// the page does.

// Projects are rows in public.projects as of migration 0020, not a union of
// known ids — the list grows whenever OCIC breaks ground, so a closed union
// would be a lie. The id is stored on every report and frozen at creation:
// renaming a project changes its label, never its id.
export interface ProjectRecord {
  id: string;
  label: string;
  // For the print letterhead, where "Chroy Changvar Bay" is longer than the
  // line wants to give it.
  short: string;
  sort_order: number;
}

export const ALL_PROJECTS = "all";
export const ALL_STREAMS = "all";

export interface StreamTotals {
  amount: number;
  units: number;
}

export function monthTotals(
  items: readonly ProjectReportItem[],
  monthIndex: number
): StreamTotals {
  const amountKey = MONTH_KEYS[monthIndex];
  const unitKey = UNIT_KEYS[monthIndex];
  return items.reduce(
    (acc, item) => ({
      amount: acc.amount + Number(item[amountKey] ?? 0),
      units: acc.units + Number(item[unitKey] ?? 0),
    }),
    { amount: 0, units: 0 }
  );
}

export function yearTotals(
  items: readonly ProjectReportItem[]
): StreamTotals {
  return items.reduce(
    (acc, item) => ({
      amount: acc.amount + itemTotal(item as MonthlyAmounts),
      units: acc.units + itemUnitTotal(item as MonthlyUnits),
    }),
    { amount: 0, units: 0 }
  );
}

// Which months have actually been reported, so the table stops at June rather
// than trailing six empty columns for a year that is half done — and so the
// year-on-year comparison compares like periods.
export function reportedMonths(
  items: readonly ProjectReportItem[]
): number[] {
  return MONTH_KEYS.map((_, index) => index).filter((index) =>
    isReportedMonth(items, index)
  );
}

export interface Comparison {
  months: number[];
  current: StreamTotals;
  previous: StreamTotals;
  amountChange: number;
  amountPercent: number | null;
  unitChange: number;
  unitPercent: number | null;
}

// The comparison block at the bottom of each of the workbook's sections.
//
// It compares only the months *both* years have reported. Comparing a half-done
// 2026 against a complete 2025 would show a collapse that is really just the
// calendar, and that is exactly the kind of number someone repeats in a meeting
// before anyone checks it. The workbook does the same thing by hand, and
// mislabelled it "Jan-May" while showing Jan–June; deriving the range removes
// the chance of that drifting again.
export function compareYears(
  current: readonly ProjectReportItem[],
  previous: readonly ProjectReportItem[]
): Comparison {
  const shared = reportedMonths(current).filter((month) =>
    reportedMonths(previous).includes(month)
  );

  const sum = (items: readonly ProjectReportItem[]): StreamTotals =>
    shared.reduce(
      (acc, monthIndex) => {
        const month = monthTotals(items, monthIndex);
        return {
          amount: acc.amount + month.amount,
          units: acc.units + month.units,
        };
      },
      { amount: 0, units: 0 }
    );

  const now = sum(current);
  const before = sum(previous);

  // A percentage against a zero base is undefined, not infinite — "up 100%"
  // from nothing is a claim the data cannot support, so the caller renders a
  // dash instead.
  const percent = (from: number, to: number) =>
    from === 0 ? null : ((to - from) / from) * 100;

  return {
    months: shared,
    current: now,
    previous: before,
    amountChange: now.amount - before.amount,
    amountPercent: percent(before.amount, now.amount),
    unitChange: now.units - before.units,
    unitPercent: percent(before.units, now.units),
  };
}

// A category and the units inside it. Every report renders all four headings
// whether or not it has anything under them, then any category the data carries
// that the fixed list does not — which in practice means Unassigned, and would
// mean a fifth heading if the office ever adds one.
export interface CategoryGroup {
  category: string;
  items: ProjectReportItem[];
  // True when the category holds a single unit named after the category itself,
  // which is how the sales report is shaped: "Land" is both the heading and the
  // only thing under it. Rendering a sub-header repeating the word would be a
  // second row of the same information.
  selfNamed: boolean;
  // A subtotal column only earns its place when there is more than one unit to
  // add up; with one, it would restate the column beside it.
  showSubtotal: boolean;
}

export function groupByCategory(
  items: readonly ProjectReportItem[]
): CategoryGroup[] {
  const byCategory = new Map<string, ProjectReportItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNASSIGNED_CATEGORY;
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  const extras = [...byCategory.keys()]
    .filter((key) => !PROJECT_CATEGORIES.includes(key as never))
    .sort((a, b) =>
      // Unassigned last, whatever else sorts alphabetically before it.
      a === UNASSIGNED_CATEGORY
        ? 1
        : b === UNASSIGNED_CATEGORY
          ? -1
          : a.localeCompare(b)
    );

  return [...PROJECT_CATEGORIES, ...extras].map((category) => {
    const group = (byCategory.get(category) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
    return {
      category,
      items: group,
      selfNamed: group.length === 1 && group[0].name.trim() === category,
      showSubtotal: group.length > 1,
    };
  });
}

// The month's figures for one category — the subtotal column, and what a
// category with no units of its own renders as.
export function categoryMonthTotals(
  group: CategoryGroup,
  monthIndex: number
): StreamTotals {
  return monthTotals(group.items, monthIndex);
}

export function categoryTotals(group: CategoryGroup): StreamTotals {
  return yearTotals(group.items);
}

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
