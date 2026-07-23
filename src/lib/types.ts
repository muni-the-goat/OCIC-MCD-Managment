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

// The platforms a monthly report can carry performance figures for. Same rules
// as TASK_TYPES: only ever append, and renaming an id orphans the figures
// already saved under it. Order is the display order, nothing more — these do
// not take colour slots, because the metrics table is a table, not a chart.
export const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "telegram", label: "Telegram" },
  { id: "website", label: "Website" },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]["id"];
export const PLATFORM_IDS = PLATFORMS.map((entry) => entry.id) as PlatformId[];

export function platformLabel(platform: PlatformId) {
  return PLATFORMS.find((entry) => entry.id === platform)?.label ?? platform;
}

// The figures a platform row can carry. `rate` values are percentages exactly
// as the platforms report them — 5.02 means 5.02%, so nothing here is ever
// multiplied by 100 on the way in or out.
export const METRICS = [
  { id: "posts", label: "Posts", kind: "count" },
  { id: "views", label: "Views", kind: "count" },
  { id: "reach", label: "Reach", kind: "count" },
  { id: "profile_views", label: "Profile views", kind: "count" },
  { id: "interactions", label: "Interactions", kind: "count" },
  { id: "likes", label: "Likes", kind: "count" },
  { id: "shares", label: "Shares", kind: "count" },
  { id: "visits", label: "Visits", kind: "count" },
  { id: "follows", label: "Follows", kind: "count" },
  { id: "link_clicks", label: "Link clicks", kind: "count" },
  { id: "engagement_rate", label: "Engagement rate", kind: "rate" },
  { id: "follow_rate", label: "Follow rate", kind: "rate" },
  { id: "visit_rate", label: "Visit rate", kind: "rate" },
] as const;
export type MetricId = (typeof METRICS)[number]["id"];
export const METRIC_IDS = METRICS.map((entry) => entry.id) as MetricId[];

export function metricLabel(metric: MetricId) {
  return METRICS.find((entry) => entry.id === metric)?.label ?? metric;
}

// A metric missing from `values` was not measured; a metric present at 0 was
// measured and came back zero. The distinction is the whole reason this is a
// sparse map rather than a fixed row of numbers: LinkedIn publishing nothing
// in a month is a reported zero, while TikTok having no "visits" concept at
// all is an absence. Collapsing the two would let an absence read as a slump.
export interface PlatformMetrics {
  platform: PlatformId;
  values: Partial<Record<MetricId, number>>;
}

const countFormat = new Intl.NumberFormat("en-US");
const rateFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatMetric(metric: MetricId, value: number) {
  return METRICS.find((entry) => entry.id === metric)?.kind === "rate"
    ? `${rateFormat.format(value)}%`
    : countFormat.format(value);
}

// The metrics actually reported by at least one platform in a set of rows, in
// METRICS order. A table over every metric would be mostly empty columns; this
// is what lets the table carry only the ones the month has figures for.
export function reportedMetrics(rows: PlatformMetrics[]): MetricId[] {
  return METRIC_IDS.filter((metric) =>
    rows.some((row) => row.values[metric] !== undefined)
  );
}

export interface MonthlyContent {
  summary?: string;
  accomplishments?: string;
  challenges?: string;
  next_month_plan?: string;
  tasks?: ReportTask[];
  metrics?: PlatformMetrics[];
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
