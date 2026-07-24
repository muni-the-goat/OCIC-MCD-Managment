export type AppRole =
  | "admin"
  | "head_of_department"
  | "coordinator"
  | "manager"
  | "staff";
export type ReportType = "budget" | "monthly";
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

export function roleLabel(role: AppRole) {
  return role === "head_of_department"
    ? "Head of Department"
    : role === "coordinator"
      ? "Coordinator"
    : role.charAt(0).toUpperCase() + role.slice(1);
}

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
