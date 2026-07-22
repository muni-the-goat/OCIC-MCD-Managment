export type AppRole =
  | "admin"
  | "head_of_department"
  | "coordinator"
  | "manager"
  | "staff";
export type ReportType = "budget" | "monthly";
export type BudgetPeriod = "annual" | "monthly";
export type ReportStatus = "draft" | "submitted" | "reviewed" | "rejected";

// Mirrors the check constraint in the latest department migration (0011) —
// change both together. Adding a department needs a new migration widening that
// constraint; the ids are stored values, so renaming one orphans every profile
// holding it.
//
// Unlike TASK_TYPES, the order here is presentational only: nothing resolves a
// department by index — departmentLabel() looks up by id — so a new entry can
// sit wherever it reads best. Admin/HR stays last as the non-marketing bucket.
export const DEPARTMENTS = [
  { id: "digital_marketing", label: "Digital Marketing" },
  { id: "multimedia", label: "Multimedia" },
  { id: "brand_marketing", label: "Brand Marketing" },
  { id: "product_marketing", label: "Product Marketing" },
  { id: "kti_marketing", label: "KTI Marketing" },
  { id: "partnership_marketing", label: "Partnership Marketing" },
  { id: "event_marketing", label: "Event Marketing" },
  { id: "admin_hr", label: "Admin/HR" },
] as const;
export type Department = (typeof DEPARTMENTS)[number]["id"];
export const DEPARTMENT_IDS = DEPARTMENTS.map(
  (department) => department.id
) as Department[];

export function departmentLabel(department: Department | null | undefined) {
  return (
    DEPARTMENTS.find((entry) => entry.id === department)?.label ?? "Unassigned"
  );
}

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

// The task taxonomy the monthly-report pie chart slices by. Editing this list is
// the single lever for the whole feature: it drives the form's type picker, the
// chart's legend, and the colour each type is painted with. Order is meaningful —
// slot N always takes --series-N, so a type keeps its colour no matter which types
// happen to appear in a given month. Only ever append; renaming an id orphans the
// tasks already saved under it.
export const TASK_TYPES = [
  { id: "website", label: "Website" },
  { id: "social_media", label: "Social media" },
  { id: "content_design", label: "Content & design" },
  { id: "video_photo", label: "Video & photo" },
  { id: "event_campaign", label: "Event & campaign" },
  { id: "other", label: "Other" },
] as const;
export type TaskType = (typeof TASK_TYPES)[number]["id"];
export const TASK_TYPE_IDS = TASK_TYPES.map((type) => type.id) as TaskType[];

export interface ReportTask {
  name: string;
  type: TaskType;
}

export function taskTypeLabel(type: TaskType) {
  return TASK_TYPES.find((entry) => entry.id === type)?.label ?? "Other";
}

// Colour is bound to the type's position in TASK_TYPES, never to its rank in a
// chart — filtering a month down to three types must not repaint the survivors.
export function taskTypeColor(type: TaskType) {
  const slot = TASK_TYPE_IDS.indexOf(type);
  return `var(--series-${(slot < 0 ? TASK_TYPE_IDS.length - 1 : slot) + 1})`;
}

export interface MonthlyContent {
  summary?: string;
  accomplishments?: string;
  challenges?: string;
  next_month_plan?: string;
  tasks?: ReportTask[];
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
