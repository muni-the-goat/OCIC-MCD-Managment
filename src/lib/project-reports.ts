import {
  BUILT_BAND,
  BUILT_CATEGORIES,
  LAND_CATEGORY,
  MONTH_KEYS,
  UNIT_KEYS,
  isReportedMonth,
  itemTotal,
  itemUnitTotal,
  type MonthlyAmounts,
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

// A column of a report table: one filing category, and every unit filed under
// it.
//
// The units are what the figures come from, but they are summed into their
// category rather than each taking a column of its own. A column per building
// is how Koh Pich's leasing table reached thirteen of them — a row nobody could
// read across, and whose Total fell off the edge of the printed page.
export interface ReportColumn {
  label: string;
  items: ProjectReportItem[];
}

// A band across the top of the table. Two of them carry every report: Land, and
// everything built on it.
//
// A category the data files outside those two — Unassigned, or a fifth the
// office adds later — follows as its own band rather than being folded into
// one of them. Which side of the line an unfiled unit belongs on is not a
// question the table can answer, and a table that guessed would be stating
// something nobody checked.
export interface ReportBand {
  label: string;
  columns: ReportColumn[];
  // True when the band is a single column named after the band itself. The
  // sub-header row leaves it blank: repeating the word underneath would be a
  // second row of the same information.
  selfNamed: boolean;
  // A subtotal only earns its place where there is more than one column to add
  // up; with one, it would restate the column beside it.
  showSubtotal: boolean;
}

export function groupIntoBands(
  items: readonly ProjectReportItem[]
): ReportBand[] {
  const byCategory = new Map<string, ProjectReportItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNASSIGNED_CATEGORY;
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  // A category with nothing in it still gets its column, of em dashes. The
  // headings are meant to be the same on every table: one that changes between
  // projects is one you re-read each time.
  const column = (label: string): ReportColumn => ({
    label,
    items: byCategory.get(label) ?? [],
  });

  const banded = new Set<string>([LAND_CATEGORY, ...BUILT_CATEGORIES]);
  const extras = [...byCategory.keys()]
    .filter((key) => !banded.has(key))
    .sort((a, b) =>
      // Unassigned last, whatever else sorts alphabetically before it.
      a === UNASSIGNED_CATEGORY
        ? 1
        : b === UNASSIGNED_CATEGORY
          ? -1
          : a.localeCompare(b)
    );

  return [
    {
      label: LAND_CATEGORY,
      columns: [column(LAND_CATEGORY)],
      selfNamed: true,
      showSubtotal: false,
    },
    {
      label: BUILT_BAND,
      columns: BUILT_CATEGORIES.map(column),
      selfNamed: false,
      showSubtotal: true,
    },
    ...extras.map((label) => ({
      label,
      columns: [column(label)],
      selfNamed: true,
      showSubtotal: false,
    })),
  ];
}

// Every unit under a band, for its subtotal — the "total built properties"
// figure the report is read for.
export function bandItems(band: ReportBand): ProjectReportItem[] {
  return band.columns.flatMap((column) => column.items);
}

// How many table columns a band occupies: one per category, plus its subtotal
// where it has one. Shared by the screen table and the print document, which
// used to carry a copy each and could have drifted into disagreeing about a
// header's span.
export function bandColumnCount(band: ReportBand): number {
  return band.columns.length + (band.showSubtotal ? 1 : 0);
}

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
