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

// What the reader has asked to see, at whichever of the three tiers they picked
// it: the bands, the categories inside them, or one named property.
//
// The tiers overlap on purpose — "Total Land" and "Land" select the same rows,
// because Land is a band of one category. The Vice President asked for the
// report to read at all three levels, and a filter that hid a level to avoid
// repeating itself would be answering a question he did not ask.
export const ALL_CATEGORIES = "all";

export type CategorySelection =
  | { kind: "all" }
  | { kind: "band"; label: string }
  | { kind: "category"; label: string }
  | { kind: "property"; name: string };

export const ALL_SELECTION: CategorySelection = { kind: "all" };

function categoryOf(item: ProjectReportItem): string {
  return item.category?.trim() || UNASSIGNED_CATEGORY;
}

// Two spellings of one building are one property. The Elysée was entered with
// its accent in the property management report and without it in leasing, and
// because a unit's name is its identity the filter offered both — picking
// either showed half the building.
//
// Migration 0025 settles the spelling in the data. This is what keeps the
// filter right afterwards: the day somebody types "the elysee" into a new
// month, it lands on the property that already exists rather than founding a
// second one. Case, spacing and accents are set aside; nothing else is, so two
// buildings that genuinely differ stay apart.
function propertyKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

// The band a category belongs to. Anything outside the two stands as its own,
// the same rule the table follows.
export function bandOf(category: string): string {
  if (category === LAND_CATEGORY) return LAND_CATEGORY;
  return BUILT_CATEGORIES.includes(category as never) ? BUILT_BAND : category;
}

const unassignedLast = (a: string, b: string) =>
  a === UNASSIGNED_CATEGORY
    ? 1
    : b === UNASSIGNED_CATEGORY
      ? -1
      : a.localeCompare(b);

// The rows a selection keeps. Applied before anything is grouped or summed, so
// every figure on the page — the subtotals, the Total, the year-on-year
// comparison — is of what the reader asked for rather than of everything with
// the rest hidden.
export function filterItems(
  items: readonly ProjectReportItem[],
  selection: CategorySelection
): ProjectReportItem[] {
  switch (selection.kind) {
    case "all":
      return [...items];
    case "band":
      return items.filter((item) => bandOf(categoryOf(item)) === selection.label);
    case "category":
      return items.filter((item) => categoryOf(item) === selection.label);
    case "property": {
      const key = propertyKey(selection.name);
      return items.filter((item) => propertyKey(item.name) === key);
    }
  }
}

// Which category columns a selection puts on the table.
//
// "All" keeps the fixed shape — every category, whether or not the project
// traded in it — because a header that changes between projects is one you
// re-read each time. A narrowed view drops the rest: a table asked for
// Commercial that still carries three columns of dashes is answering a
// question nobody asked.
function selectedCategories(
  selection: CategorySelection,
  items: readonly ProjectReportItem[]
): string[] | null {
  switch (selection.kind) {
    case "all":
      return null;
    case "band":
      return selection.label === LAND_CATEGORY
        ? [LAND_CATEGORY]
        : [...BUILT_CATEGORIES];
    case "category":
      return [selection.label];
    // The property's own category, read off the rows it left behind — which is
    // how a property filed as Unassigned still gets the band it belongs to.
    case "property":
      return [...new Set(items.map(categoryOf))];
  }
}

export function groupIntoBands(
  items: readonly ProjectReportItem[],
  selection: CategorySelection = ALL_SELECTION
): ReportBand[] {
  const byCategory = new Map<string, ProjectReportItem[]>();
  for (const item of items) {
    const key = categoryOf(item);
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

  const wanted = selectedCategories(selection, items);
  const shown = (label: string) => wanted === null || wanted.includes(label);

  const banded = new Set<string>([LAND_CATEGORY, ...BUILT_CATEGORIES]);
  const extras = (wanted === null ? [...byCategory.keys()] : wanted)
    .filter((key) => !banded.has(key))
    .sort(unassignedLast);

  const builtColumns = BUILT_CATEGORIES.filter(shown).map(column);

  const bands = [
    ...(shown(LAND_CATEGORY)
      ? [
          {
            label: LAND_CATEGORY,
            columns: [column(LAND_CATEGORY)],
            selfNamed: true,
            showSubtotal: false,
          },
        ]
      : []),
    ...(builtColumns.length > 0
      ? [
          {
            label: BUILT_BAND,
            columns: builtColumns,
            selfNamed: false,
            showSubtotal: builtColumns.length > 1,
          },
        ]
      : []),
    ...extras.map((label) => ({
      label,
      columns: [column(label)],
      selfNamed: true,
      showSubtotal: false,
    })),
  ];

  // A band's subtotal is only worth a row where another band has something to
  // add to it. With one band carrying every figure — Koh Pich leases no land,
  // so Built properties is the whole of its leasing report — the subtotal and
  // the Total are the same number, one directly above the other. The Total
  // keeps its place; the subtotal stands down.
  const carrying = bands.filter((band) => bandItems(band).length > 0).length;
  return carrying > 1
    ? bands
    : bands.map((band) => ({ ...band, showSubtotal: false }));
}

// The grand total earns its place once there is more than one category on the
// table. Filtered to a single one it would restate that category's row exactly,
// figure for figure.
export function showsGrandTotal(bands: readonly ReportBand[]): boolean {
  return bands.reduce((n, band) => n + band.columns.length, 0) > 1;
}

// Every unit under a band, for its subtotal — the "total built properties"
// figure the report is read for.
export function bandItems(band: ReportBand): ProjectReportItem[] {
  return band.columns.flatMap((column) => column.items);
}

// The properties behind the categories, in band order, skipping the categories
// nothing was filed under.
//
// The summary table answers "how much land, how much built". This answers "and
// which building" — the question the per-building columns used to answer badly,
// by making the reader track a figure across thirteen of them. As rows it reads
// down instead of across, and a project can add a property without the table
// growing sideways.
export interface PropertyGroup {
  category: string;
  items: ProjectReportItem[];
}

export function propertyGroups(
  items: readonly ProjectReportItem[]
): PropertyGroup[] {
  return groupIntoBands(items)
    .flatMap((band) => band.columns)
    .filter((column) => column.items.length > 0)
    .map((column) => ({
      category: column.label,
      items: [...column.items].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      ),
    }));
}

// The three tiers, as the filter offers them. Built from the reports actually
// on screen, so the list never offers a property that the chosen project and
// report do not have.
export interface CategoryOptions {
  bands: string[];
  categories: string[];
  properties: string[];
}

export function categoryOptions(
  items: readonly ProjectReportItem[]
): CategoryOptions {
  const extras = [...new Set(items.map(categoryOf))]
    .filter(
      (category) =>
        category !== LAND_CATEGORY &&
        !BUILT_CATEGORIES.includes(category as never)
    )
    .sort(unassignedLast);

  return {
    bands: [LAND_CATEGORY, BUILT_BAND],
    categories: [LAND_CATEGORY, ...BUILT_CATEGORIES, ...extras],
    // A row named after its own category is the category, not a property under
    // it — the sales report is filed that way, and listing "House" under
    // properties would be the same word offered twice.
    //
    // One entry per building, not per spelling of it. Where the reports
    // disagree the list shows the first spelling in order, and the filter
    // matches every variant of it either way.
    properties: [
      ...new Map(
        items
          .filter((item) => item.name.trim() !== categoryOf(item))
          .map((item) => item.name.trim())
          .sort((a, b) => a.localeCompare(b))
          .map((name) => [propertyKey(name), name] as const)
          .reverse()
      ).values(),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

// The URL carries the tier as well as the name, because the tiers overlap:
// "Land" is a band and a category, and only the prefix says which one was
// clicked. An unknown or stale value falls back to everything rather than to an
// empty page — a link shared before a property was renamed still opens.
export function parseCategorySelection(
  value: string | undefined,
  options: CategoryOptions
): CategorySelection {
  const [kind, ...rest] = (value ?? "").split(":");
  const label = rest.join(":");

  if (kind === "band" && options.bands.includes(label)) {
    return { kind: "band", label };
  }
  if (kind === "category" && options.categories.includes(label)) {
    return { kind: "category", label };
  }
  if (kind === "property") {
    // Matched loosely, so a link someone sent naming the other spelling still
    // opens on the building rather than falling back to the whole report.
    const known = options.properties.find(
      (property) => propertyKey(property) === propertyKey(label)
    );
    if (known) return { kind: "property", name: known };
  }
  return ALL_SELECTION;
}

export function categorySelectionValue(selection: CategorySelection): string {
  switch (selection.kind) {
    case "all":
      return ALL_CATEGORIES;
    case "band":
      return `band:${selection.label}`;
    case "category":
      return `category:${selection.label}`;
    case "property":
      return `property:${selection.name}`;
  }
}

// For the print letterhead, which states what the reader was looking at when
// they pressed Export.
export function categorySelectionLabel(selection: CategorySelection): string {
  switch (selection.kind) {
    case "all":
      return "All categories";
    case "band":
      return selection.label === BUILT_BAND
        ? "Total built properties"
        : "Total land";
    case "category":
      return selection.label;
    case "property":
      return selection.name;
  }
}

// Whether naming the properties would say anything the summary has not. The
// sales report files one row per category, named after it — "House" inside
// House — so a detail table there would be the same figures under the same
// words, which is a table that wastes the reader's time.
export function hasNamedProperties(
  items: readonly ProjectReportItem[]
): boolean {
  return items.some(
    (item) => item.name.trim() !== (item.category?.trim() || UNASSIGNED_CATEGORY)
  );
}


export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
