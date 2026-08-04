import {
  MONTH_KEYS,
  UNIT_KEYS,
  isReportedMonth,
  itemTotal,
  itemUnitTotal,
  type MonthlyAmounts,
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

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
