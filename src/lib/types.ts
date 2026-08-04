export type AppRole =
  | "admin"
  | "vice_president"
  | "head_of_department"
  | "vp_assistant"
  | "coordinator"
  | "manager"
  | "staff";
export type ReportType = "budget" | "monthly";

// The Vice President's three reports. A different subject from everything else
// here — what OCIC's projects earned, rather than what the marketing department
// spent — which is why they are their own tables rather than a third ReportType.
export type ProjectStream = "sales" | "leasing" | "property_management";

export const PROJECT_STREAMS: readonly ProjectStream[] = [
  "sales",
  "leasing",
  "property_management",
];

const PROJECT_STREAM_LABELS: Record<ProjectStream, string> = {
  sales: "Sales performance",
  leasing: "Leasing",
  property_management: "Property management",
};

export function projectStreamLabel(stream: ProjectStream) {
  return PROJECT_STREAM_LABELS[stream];
}

// What each stream's rows are, for column headers and empty states — "Add a
// property" is a better prompt than "Add an item", and on the sales report
// neither would be right.
const PROJECT_STREAM_NOUNS: Record<ProjectStream, string> = {
  sales: "property type",
  leasing: "property",
  property_management: "property",
};

export function projectStreamNoun(stream: ProjectStream) {
  return PROJECT_STREAM_NOUNS[stream];
}

// The four headings every project report carries, in the order they appear on
// every table. Fixed rather than derived from the data: the Vice President
// asked for the same shape on each report whether or not a project traded in
// all four this year, and a header that changes between projects is a header
// you have to re-read every time.
export const PROJECT_CATEGORIES = [
  "Land",
  "House",
  "Condo",
  "Commercial",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

// Where a unit sits until somebody who knows the portfolio files it. Rendered
// as its own group after the four, so the gap is visible rather than absorbed
// into a category it may not belong to.
export const UNASSIGNED_CATEGORY = "Unassigned";

// Only the sales report counts units. The other two have amounts alone, and
// showing them a units column of zeros would be a column that means nothing.
export function streamTracksUnits(stream: ProjectStream) {
  return stream === "sales";
}
export type BudgetPeriod = "annual" | "monthly";
export type ReportStatus = "draft" | "submitted" | "reviewed" | "rejected";

// Departments are rows in public.departments as of migration 0013, not a union
// of known ids — an Admin or Head of Department can add one from the Users page,
// so the set is open at runtime and a closed union would be a lie. The reader,
// the label lookup, and the id generator all live in src/lib/departments.ts.
//
// The id is the stored value on every profile and is frozen at creation:
// renaming a department changes its label, never its id.
export type Department = string;

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  // Null until an Admin assigns one; accounts predate the department column.
  department: Department | null;
  created_at: string;
}

// A Record rather than a chain of ternaries with a capitalise-the-id fallback:
// the fallback is what would have rendered the newest role as "Vp_assistant"
// without anyone noticing. Exhaustive by type, so a role added to AppRole
// without a label here fails the build.
const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  vice_president: "Vice President",
  head_of_department: "Head of Department",
  vp_assistant: "VP Assistant",
  coordinator: "Coordinator",
  manager: "Manager",
  staff: "Staff",
};

export function roleLabel(role: AppRole) {
  return ROLE_LABELS[role];
}

// Every role a picker may offer, least senior first — the same order as the
// hierarchy in src/lib/roles.ts. Shared by the invite dialog and the Users table
// select, which each kept their own hand-written list and had already drifted
// out of agreement on ordering. Admin is included here and dropped by the caller
// when the signed-in user may not grant it.
export const ASSIGNABLE_ROLES: readonly AppRole[] = [
  "staff",
  "manager",
  "coordinator",
  "vp_assistant",
  "head_of_department",
  "vice_president",
  "admin",
];

// A monthly activity report is four blocks of prose plus whatever documents the
// author attaches. It also used to carry a typed task list and per-platform
// social figures; both were removed once it became clear each team writes the
// month up differently, and the structured fields fitted none of them. Reports
// written before that still hold `tasks` and `metrics` keys in this jsonb —
// nothing reads them, and a save rewrites the object without them. See
// PROGRESS.md for the plan to bring structured activity data back.
export interface MonthlyContent {
  summary?: string;
  accomplishments?: string;
  challenges?: string;
  next_month_plan?: string;
}

export interface Report {
  id: string;
  author_id: string;
  type: ReportType;
  budget_period: BudgetPeriod;
  title: string;
  period_month: number;
  period_year: number;
  status: ReportStatus;
  content: MonthlyContent;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MONTH_KEYS = [
  "m01",
  "m02",
  "m03",
  "m04",
  "m05",
  "m06",
  "m07",
  "m08",
  "m09",
  "m10",
  "m11",
  "m12",
] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];
export type MonthlyAmounts = Record<MonthKey, number>;

export interface BudgetItem extends MonthlyAmounts {
  id: string;
  report_id: string;
  section: string;
  name: string;
  sort_order: number;
}

export const UNIT_KEYS = [
  "u01",
  "u02",
  "u03",
  "u04",
  "u05",
  "u06",
  "u07",
  "u08",
  "u09",
  "u10",
  "u11",
  "u12",
] as const;
export type UnitKey = (typeof UNIT_KEYS)[number];
export type MonthlyUnits = Record<UnitKey, number>;

export interface ProjectReportItem extends MonthlyAmounts, MonthlyUnits {
  id: string;
  report_id: string;
  // One of PROJECT_CATEGORIES, or UNASSIGNED_CATEGORY. Free text in the column
  // so a fifth heading needs no migration, ordered by the list above.
  category: string;
  name: string;
  sort_order: number;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  stream: ProjectStream;
  period_year: number;
  updated_at: string;
  items: ProjectReportItem[];
}

export function itemUnitTotal(item: MonthlyUnits): number {
  return UNIT_KEYS.reduce((sum, key) => sum + Number(item[key] ?? 0), 0);
}

// A month with no figures is an unreported month, not a month in which nothing
// happened, and the two must not look the same. Everything downstream — the
// cell renderer, the year-to-date range, the comparison — asks this rather than
// testing for zero, so the distinction is made once.
export function isReportedMonth(
  items: readonly (MonthlyAmounts & Partial<MonthlyUnits>)[],
  monthIndex: number
): boolean {
  const amountKey = MONTH_KEYS[monthIndex];
  const unitKey = UNIT_KEYS[monthIndex];
  return items.some(
    (item) =>
      Number(item[amountKey] ?? 0) !== 0 || Number(item[unitKey] ?? 0) !== 0
  );
}

export interface BudgetHistoryReport {
  id: string;
  title: string;
  status: ReportStatus;
  period_month: number;
  period_year: number;
  updated_at: string;
  items: BudgetItem[];
}

// Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec
export const QUARTERS = [
  { label: "Quarter 1", months: [0, 1, 2] },
  { label: "Quarter 2", months: [3, 4, 5] },
  { label: "Quarter 3", months: [6, 7, 8] },
  { label: "Quarter 4", months: [9, 10, 11] },
] as const;

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function itemTotal(item: MonthlyAmounts): number {
  return MONTH_KEYS.reduce((sum, key) => sum + Number(item[key] ?? 0), 0);
}

export interface ReportComment {
  id: string;
  report_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ReportAttachment {
  id: string;
  report_id: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function periodLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

export function reportPeriodLabel(
  type: ReportType,
  month: number,
  year: number,
  budgetPeriod: BudgetPeriod = "annual"
) {
  return type === "budget" && budgetPeriod === "annual"
    ? `FY ${year}`
    : periodLabel(month, year);
}

export function reportTypeLabel(
  type: ReportType,
  budgetPeriod: BudgetPeriod = "annual"
) {
  if (type === "monthly") return "Monthly activity";
  return budgetPeriod === "monthly" ? "Monthly budget" : "Annual budget";
}
