"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { History, Plus, Trash2 } from "lucide-react";
import { saveReport, type ActionState } from "@/app/(app)/reports/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  METRICS,
  METRIC_IDS,
  MONTH_KEYS,
  MONTH_NAMES,
  MONTH_SHORT,
  PLATFORM_IDS,
  TASK_TYPES,
  TASK_TYPE_IDS,
  platformLabel,
  type BudgetHistoryReport,
  type BudgetItem,
  type MetricId,
  type PlatformId,
  type PlatformMetrics,
  type Report,
  type ReportTask,
  type ReportType,
  type TaskType,
} from "@/lib/types";

interface EditItem {
  name: string;
  amounts: string[]; // length 12, as raw input strings
}
interface EditSection {
  name: string;
  items: EditItem[];
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function emptyItem(): EditItem {
  return { name: "", amounts: Array(12).fill("") };
}

const DEFAULT_TASK_TYPE: TaskType = TASK_TYPES[0].id;

// A report saved before the task list existed has no `tasks` key at all, and a
// hand-edited one could hold anything — start from a single blank row either
// way rather than trusting the shape.
function tasksFromContent(tasks?: ReportTask[]): ReportTask[] {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [{ name: "", type: DEFAULT_TASK_TYPE }];
  }
  return tasks.map((task) => ({
    name: typeof task?.name === "string" ? task.name : "",
    type: TASK_TYPE_IDS.includes(task?.type) ? task.type : "other",
  }));
}

// Metric inputs are held as raw strings so "" stays distinguishable from "0"
// all the way to submit — see PlatformMetrics in lib/types for why that
// difference is load-bearing.
interface EditMetrics {
  platform: PlatformId;
  values: Partial<Record<MetricId, string>>;
}

function metricsFromContent(rows?: PlatformMetrics[]): EditMetrics[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => PLATFORM_IDS.includes(row?.platform))
    .map((row) => ({
      platform: row.platform,
      values: Object.fromEntries(
        METRIC_IDS.filter(
          (metric) => typeof row.values?.[metric] === "number"
        ).map((metric) => [metric, String(row.values[metric])])
      ),
    }));
}

// "" is not measured and is left out entirely; "0" is a measured zero and is
// kept. Anything unparseable is dropped rather than saved as 0, so a typo
// cannot quietly become a reported figure.
function metricsPayload(rows: EditMetrics[]): string {
  return JSON.stringify(
    rows
      .map((row) => ({
        platform: row.platform,
        values: Object.fromEntries(
          METRIC_IDS.flatMap((metric) => {
            const raw = row.values[metric]?.trim() ?? "";
            if (raw === "") return [];
            const value = Number(raw);
            return Number.isFinite(value) && value >= 0
              ? [[metric, value] as const]
              : [];
          })
        ),
      }))
      .filter((row) => Object.keys(row.values).length > 0)
  );
}

function num(raw: string): number {
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Rebuild grouped sections from the flat budget_items rows (order preserved).
function sectionsFromItems(
  items: BudgetItem[],
  includeAmounts = true
): EditSection[] {
  const bySection = new Map<string, EditSection>();
  const order: string[] = [];
  for (const item of items) {
    const key = item.section ?? "";
    if (!bySection.has(key)) {
      bySection.set(key, { name: key, items: [] });
      order.push(key);
    }
    bySection.get(key)!.items.push({
      name: item.name,
      amounts: MONTH_KEYS.map((m) => {
        if (!includeAmounts) return "";
        const v = Number(item[m] ?? 0);
        return v === 0 ? "" : String(v);
      }),
    });
  }
  const result = order.map((k) => bySection.get(k)!);
  return result.length > 0
    ? result
    : [{ name: "", items: [emptyItem()] }];
}

function periodIndex(month: number, year: number) {
  return year * 12 + month;
}

function findPreviousBudget(
  history: BudgetHistoryReport[],
  month: number,
  year: number
) {
  const target = periodIndex(month, year);
  return history
    .filter(
      (entry) =>
        entry.items.length > 0 &&
        periodIndex(entry.period_month, entry.period_year) < target
    )
    .sort(
      (a, b) =>
        periodIndex(b.period_month, b.period_year) -
          periodIndex(a.period_month, a.period_year) ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
}

function historyItemKey(section: string, name: string) {
  return `${section.trim().toLowerCase()}\u0000${name.trim().toLowerCase()}`;
}

export function ReportForm({
  type,
  report,
  budgetItems,
  budgetHistory = [],
}: {
  type: ReportType;
  report?: Report;
  budgetItems?: BudgetItem[];
  budgetHistory?: BudgetHistoryReport[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveReport,
    null
  );

  const now = new Date();
  const content = report?.content ?? {};
  // New budget reports are monthly-only. Existing annual reports keep their
  // legacy layout when edited so historical data remains maintainable.
  const budgetPeriod = report?.budget_period ?? "monthly";
  const initialBudgetMonth = report?.period_month ?? now.getMonth() + 1;
  const initialBudgetYear = report?.period_year ?? now.getFullYear();
  const initialHistory = report
    ? undefined
    : findPreviousBudget(
        budgetHistory,
        initialBudgetMonth,
        initialBudgetYear
      );
  const [budgetMonth, setBudgetMonth] = useState(initialBudgetMonth);
  const [budgetYear, setBudgetYear] = useState(initialBudgetYear);
  const isMonthlyBudget = type === "budget" && budgetPeriod === "monthly";

  const [tasks, setTasks] = useState<ReportTask[]>(() =>
    tasksFromContent(content.tasks)
  );

  const [metrics, setMetrics] = useState<EditMetrics[]>(() =>
    metricsFromContent(content.metrics)
  );

  const [sections, setSections] = useState<EditSection[]>(() =>
    report
      ? sectionsFromItems(budgetItems ?? [])
      : sectionsFromItems(initialHistory?.items ?? [], false)
  );
  const [structureDirty, setStructureDirty] = useState(false);
  const [loadedHistoryId, setLoadedHistoryId] = useState<string | null>(
    initialHistory?.id ?? null
  );

  const historySource = useMemo(
    () => findPreviousBudget(budgetHistory, budgetMonth, budgetYear),
    [budgetHistory, budgetMonth, budgetYear]
  );
  const loadedHistory = budgetHistory.find(
    (entry) => entry.id === loadedHistoryId
  );
  const existingMonthlyBudget =
    !report && isMonthlyBudget
      ? budgetHistory.find(
          (entry) =>
            entry.period_month === budgetMonth &&
            entry.period_year === budgetYear
        )
      : undefined;
  const historicalAmounts = useMemo(() => {
    const values = new Map<string, number>();
    if (!loadedHistory) return values;
    const monthKey = MONTH_KEYS[loadedHistory.period_month - 1];
    for (const item of loadedHistory.items) {
      values.set(
        historyItemKey(item.section, item.name),
        Number(item[monthKey] ?? 0)
      );
    }
    return values;
  }, [loadedHistory]);

  // Per-month grand totals + overall total.
  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    for (const section of sections) {
      for (const item of section.items) {
        for (let i = 0; i < 12; i++) totals[i] += num(item.amounts[i]);
      }
    }
    return totals;
  }, [sections]);
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0);

  const sectionMonthTotals = (section: EditSection) => {
    const totals = Array(12).fill(0);
    for (const item of section.items) {
      for (let i = 0; i < 12; i++) totals[i] += num(item.amounts[i]);
    }
    return totals;
  };

  // Blank rows are the editor's idea of an empty slot, not data — the server
  // drops them too, so the count here matches what the dashboard will chart.
  const namedTasks = tasks.filter((task) => task.name.trim() !== "");
  const tasksPayload = JSON.stringify(
    namedTasks.map((task) => ({ name: task.name.trim(), type: task.type }))
  );

  const metricsJson = metricsPayload(metrics);
  // Count of platforms that will actually save, which is not metrics.length —
  // a row opened and left blank is dropped on both sides.
  const filledPlatforms = (JSON.parse(metricsJson) as PlatformMetrics[]).length;
  const availablePlatforms = PLATFORM_IDS.filter(
    (id) => !metrics.some((row) => row.platform === id)
  );

  const updateMetric = (index: number, metric: MetricId, raw: string) =>
    setMetrics((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, values: { ...row.values, [metric]: raw } } : row
      )
    );

  const updateTask = (index: number, patch: Partial<ReportTask>) => {
    setTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, ...patch } : task))
    );
  };

  // Serialized payload for the server action.
  const budgetPayload = JSON.stringify(
    sections.map((section) => ({
      name: section.name,
      items: section.items.map((item) => ({
        name: item.name,
        amounts: item.amounts.map(num),
      })),
    }))
  );

  const updateSection = (si: number, patch: Partial<EditSection>) => {
    setStructureDirty(true);
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, ...patch } : s))
    );
  };

  const updateItem = (si: number, ii: number, patch: Partial<EditItem>) => {
    setStructureDirty(true);
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              items: s.items.map((it, j) =>
                j === ii ? { ...it, ...patch } : it
              ),
            }
          : s
      )
    );
  };

  const setAmount = (si: number, ii: number, mi: number, value: string) => {
    setStructureDirty(true);
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              items: s.items.map((it, j) =>
                j === ii
                  ? {
                      ...it,
                      amounts: it.amounts.map((a, k) => (k === mi ? value : a)),
                    }
                  : it
              ),
            }
          : s
      )
    );
  };

  const applyHistory = (source?: BudgetHistoryReport) => {
    setSections(sectionsFromItems(source?.items ?? [], false));
    setLoadedHistoryId(source?.id ?? null);
    setStructureDirty(false);
  };

  const changeBudgetPeriod = (month: number, year: number) => {
    if (!report && !structureDirty) {
      applyHistory(findPreviousBudget(budgetHistory, month, year));
    }
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input
        type="hidden"
        name="budget_period"
        value={type === "budget" ? budgetPeriod : "annual"}
      />
      {report ? <input type="hidden" name="report_id" value={report.id} /> : null}
      {type === "budget" ? (
        <input type="hidden" name="budget_sections" value={budgetPayload} />
      ) : (
        <>
          <input type="hidden" name="tasks" value={tasksPayload} />
          <input type="hidden" name="metrics" value={metricsJson} />
        </>
      )}

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {existingMonthlyBudget ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              A {existingMonthlyBudget.status} monthly budget already exists
              for {MONTH_NAMES[budgetMonth - 1]} {budgetYear}. Edit that report
              instead of creating another submission.
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/${existingMonthlyBudget.id}/edit`}>
                Edit existing report
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {report &&
      (report.status === "submitted" || report.status === "reviewed") ? (
        <Alert>
          <AlertDescription>
            Editing this {report.status} report removes its current review
            status. Submit the updated report for review again when your
            changes are ready.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>
            {type === "budget"
              ? `${budgetPeriod === "monthly" ? "Monthly" : "Annual"} budget report — actual expense`
              : "Monthly report"}
          </CardTitle>
          <CardDescription>
            {type === "budget"
              ? budgetPeriod === "monthly"
                ? "Record actual expenses for one month. This report will be reviewed independently."
                : "Record actual expenses for the full fiscal year in the Jan–Dec grid."
              : report
                ? "Update the report, then save it as a draft or submit it for review."
                : "Fill in the report, then save it as a draft or submit it for review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={report?.title ?? ""}
              placeholder={
                type === "budget"
                  ? "e.g. Digital Marketing — Actual Expense"
                  : "e.g. Operations monthly report"
              }
            />
          </div>
          {type === "budget" && budgetPeriod === "annual" ? (
            <div className="space-y-2">
              <Label htmlFor="period_year">Fiscal year</Label>
              <Input
                id="period_year"
                name="period_year"
                type="number"
                min={2000}
                max={2100}
                required
                className="max-w-40"
                defaultValue={report?.period_year ?? now.getFullYear()}
              />
              {/* Budget reports span the whole year; month is not used. */}
              <input type="hidden" name="period_month" value="1" />
            </div>
          ) : type === "budget" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget_period_month">Budget month</Label>
                <Select
                  name="period_month"
                  value={String(budgetMonth)}
                  onValueChange={(value) => {
                    const month = Number(value);
                    setBudgetMonth(month);
                    changeBudgetPeriod(month, budgetYear);
                  }}
                >
                  <SelectTrigger id="budget_period_month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_year">Budget year</Label>
                <Input
                  id="period_year"
                  name="period_year"
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={budgetYear || ""}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    setBudgetYear(year);
                    changeBudgetPeriod(budgetMonth, year);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activity_period_month">Period month</Label>
                <Select
                  name="period_month"
                  defaultValue={String(
                    report?.period_month ?? now.getMonth() + 1
                  )}
                >
                  <SelectTrigger id="activity_period_month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_year">Period year</Label>
                <Input
                  id="period_year"
                  name="period_year"
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  defaultValue={report?.period_year ?? now.getFullYear()}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {type === "monthly" ? (
        <>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              List what you worked on this month and pick a type for each one.
              The dashboard charts these — how many tasks you completed, and
              what kind of work they were. Optional, and blank rows are ignored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Task ${index + 1} description`}
                  className="min-w-48 flex-1"
                  maxLength={200}
                  placeholder="e.g. Redesigned the careers page"
                  value={task.name}
                  onChange={(event) =>
                    updateTask(index, { name: event.target.value })
                  }
                />
                <Select
                  value={task.type}
                  onValueChange={(value) =>
                    updateTask(index, { type: value as TaskType })
                  }
                >
                  <SelectTrigger
                    aria-label={`Task ${index + 1} type`}
                    className="w-48"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((taskType) => (
                      <SelectItem key={taskType.id} value={taskType.id}>
                        {taskType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove task ${index + 1}`}
                  disabled={tasks.length === 1}
                  onClick={() =>
                    setTasks((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  setTasks((prev) => [
                    ...prev,
                    { name: "", type: DEFAULT_TASK_TYPE },
                  ])
                }
              >
                <Plus className="size-4" />
                Add task
              </Button>
              <p className="text-sm text-muted-foreground">
                {namedTasks.length === 0
                  ? "No tasks listed yet"
                  : `${namedTasks.length} task${namedTasks.length === 1 ? "" : "s"} will be saved`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Social media performance</CardTitle>
            <CardDescription>
              Optional. Add a platform, then fill in only the figures that
              platform reports. A blank box means <em>not measured</em> and a{" "}
              <strong>0</strong> means measured and zero — the two are stored
              differently, so leave a box empty rather than typing 0 to fill it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.map((row, index) => (
              <div key={row.platform} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-medium">{platformLabel(row.platform)}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${platformLabel(row.platform)}`}
                    onClick={() =>
                      setMetrics((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {METRICS.map((metric) => {
                    const inputId = `${row.platform}_${metric.id}`;
                    return (
                      <div key={metric.id} className="space-y-1.5">
                        <Label
                          htmlFor={inputId}
                          className="text-xs font-normal text-muted-foreground"
                        >
                          {metric.label}
                          {metric.kind === "rate" ? " (%)" : ""}
                        </Label>
                        <Input
                          id={inputId}
                          type="number"
                          min={0}
                          // Rates arrive with decimals (5.02); counts do not,
                          // but a shared step keeps one control for both.
                          step="any"
                          inputMode="decimal"
                          className="tabular-nums"
                          value={row.values[metric.id] ?? ""}
                          onChange={(event) =>
                            updateMetric(index, metric.id, event.target.value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {availablePlatforms.length > 0 ? (
                <Select
                  // Reset to the placeholder after each pick so the same
                  // trigger can add a second platform.
                  value=""
                  onValueChange={(value) =>
                    setMetrics((prev) => [
                      ...prev,
                      { platform: value as PlatformId, values: {} },
                    ])
                  }
                >
                  <SelectTrigger className="w-56" aria-label="Add a platform">
                    <SelectValue placeholder="Add a platform…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlatforms.map((id) => (
                      <SelectItem key={id} value={id}>
                        {platformLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Every platform has been added.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {filledPlatforms === 0
                  ? "No figures entered yet"
                  : `${filledPlatforms} platform${filledPlatforms === 1 ? "" : "s"} will be saved`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Report sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ["summary", "Summary", "Overall summary of the month (required to submit)"],
                ["accomplishments", "Accomplishments", "What was completed"],
                ["challenges", "Challenges", "Blockers or issues faced"],
                ["next_month_plan", "Next month plan", "What is planned next"],
              ] as const
            ).map(([name, label, placeholder]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Textarea
                  id={name}
                  name={name}
                  rows={4}
                  placeholder={placeholder}
                  defaultValue={content[name] ?? ""}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {isMonthlyBudget
                ? `${MONTH_NAMES[budgetMonth - 1]} expenses`
                : "Monthly expenses"}
            </CardTitle>
            <CardDescription>
              Group line items into sections (e.g. Social Media Ads, Google
              Ads).{" "}
              {isMonthlyBudget
                ? `Enter each item's actual spend for ${MONTH_NAMES[budgetMonth - 1]}.`
                : "Enter each item's spend per month."}{" "}
              Grand total:{" "}
              <span className="font-semibold text-foreground">
                {currency.format(
                  isMonthlyBudget ? monthTotals[budgetMonth - 1] : grandTotal
                )}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isMonthlyBudget && !report ? (
              historySource ? (
                loadedHistoryId === historySource.id ? (
                  <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                    <History
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium">
                        Previous structure loaded from{" "}
                        {MONTH_NAMES[historySource.period_month - 1]}{" "}
                        {historySource.period_year}
                      </p>
                      <p className="text-muted-foreground">
                        Section and item names were reused for consistency.
                        Previous amounts are shown for reference but were not
                        copied into this report.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="flex gap-3">
                      <History
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">
                          A previous structure is available from{" "}
                          {MONTH_NAMES[historySource.period_month - 1]}{" "}
                          {historySource.period_year}
                        </p>
                        <p className="text-muted-foreground">
                          Replacing the structure clears the current line items
                          and amounts.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyHistory(historySource)}
                    >
                      Use previous structure
                    </Button>
                  </div>
                )
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No earlier monthly budget was found. Add the first section
                  and line items for this reporting period.
                </p>
              )
            ) : null}
            {sections.map((section, si) => {
              const subtotals = sectionMonthTotals(section);
              const sectionTotal = subtotals.reduce((a, b) => a + b, 0);
              return (
                <div key={si} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 p-3">
                    <Input
                      aria-label="Section name"
                      className="max-w-xs font-medium"
                      placeholder="Section name (e.g. Social Media Ads)"
                      value={section.name}
                      onChange={(e) =>
                        updateSection(si, { name: e.target.value })
                      }
                    />
                    <span className="ml-auto text-sm text-muted-foreground">
                      Subtotal:{" "}
                      <span className="font-semibold text-foreground">
                        {currency.format(
                          isMonthlyBudget
                            ? subtotals[budgetMonth - 1]
                            : sectionTotal
                        )}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove section"
                      disabled={sections.length === 1}
                      onClick={() => {
                        setStructureDirty(true);
                        setSections((prev) =>
                          prev.filter((_, i) => i !== si)
                        );
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className={isMonthlyBudget ? "" : "overflow-x-auto"}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="sticky left-0 z-10 min-w-44 bg-card p-2 text-left font-medium">
                            Line item
                          </th>
                          {isMonthlyBudget ? (
                            <th className="min-w-36 p-2 text-right font-medium">
                              Actual amount
                            </th>
                          ) : (
                            <>
                              {MONTH_SHORT.map((m) => (
                                <th
                                  key={m}
                                  className="min-w-20 p-2 text-right font-medium"
                                >
                                  {m}
                                </th>
                              ))}
                              <th className="min-w-24 p-2 text-right font-medium">
                                Total
                              </th>
                            </>
                          )}
                          <th className="w-10 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item, ii) => {
                          const rowTotal = item.amounts.reduce(
                            (a, b) => a + num(b),
                            0
                          );
                          const historicalAmount = loadedHistory
                            ? historicalAmounts.get(
                                historyItemKey(section.name, item.name)
                              )
                            : undefined;
                          return (
                            <tr key={ii} className="border-b last:border-0">
                              <td className="sticky left-0 z-10 bg-card p-1">
                                <Input
                                  aria-label="Item name"
                                  className="min-w-40"
                                  placeholder="e.g. Facebook"
                                  value={item.name}
                                  onChange={(e) =>
                                    updateItem(si, ii, { name: e.target.value })
                                  }
                                />
                                {historicalAmount !== undefined &&
                                loadedHistory ? (
                                  <p className="px-2 pb-1 pt-0.5 text-xs text-muted-foreground">
                                    Previous{" "}
                                    {MONTH_SHORT[
                                      loadedHistory.period_month - 1
                                    ]}{" "}
                                    {loadedHistory.period_year}:{" "}
                                    {currency.format(
                                      historicalAmount
                                    )}
                                  </p>
                                ) : null}
                              </td>
                              {(isMonthlyBudget
                                ? [item.amounts[budgetMonth - 1]]
                                : item.amounts
                              ).map((amount, visibleIndex) => {
                                const monthIndex = isMonthlyBudget
                                  ? budgetMonth - 1
                                  : visibleIndex;
                                return (
                                  <td key={monthIndex} className="p-1">
                                    <Input
                                      aria-label={`${MONTH_SHORT[monthIndex]} amount`}
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className={
                                        isMonthlyBudget
                                          ? "ml-auto w-full max-w-48 text-right"
                                          : "w-20 text-right"
                                      }
                                      placeholder="0"
                                      value={amount}
                                      onChange={(e) =>
                                        setAmount(
                                          si,
                                          ii,
                                          monthIndex,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                );
                              })}
                              {!isMonthlyBudget ? (
                                <td className="p-2 text-right font-medium tabular-nums">
                                  {currency.format(rowTotal)}
                                </td>
                              ) : null}
                              <td className="p-1 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Remove line item"
                                  disabled={section.items.length === 1}
                                  onClick={() => {
                                    setStructureDirty(true);
                                    updateSection(si, {
                                      items: section.items.filter(
                                        (_, j) => j !== ii
                                      ),
                                    });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/40 font-medium">
                          <td className="sticky left-0 z-10 bg-muted/40 p-2">
                            Subtotal
                          </td>
                          {isMonthlyBudget ? (
                            <td className="p-2 text-right tabular-nums">
                              {currency.format(subtotals[budgetMonth - 1])}
                            </td>
                          ) : (
                            <>
                              {subtotals.map((t, mi) => (
                                <td
                                  key={mi}
                                  className="p-2 text-right tabular-nums"
                                >
                                  {t ? currency.format(t) : "—"}
                                </td>
                              ))}
                              <td className="p-2 text-right tabular-nums">
                                {currency.format(sectionTotal)}
                              </td>
                            </>
                          )}
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setStructureDirty(true);
                        updateSection(si, {
                          items: [...section.items, emptyItem()],
                        });
                      }}
                    >
                      <Plus className="size-4" />
                      Add line item
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setStructureDirty(true);
                  setSections((prev) => [
                    ...prev,
                    { name: "", items: [emptyItem()] },
                  ]);
                }}
              >
                <Plus className="size-4" />
                Add section
              </Button>
              <p className="text-sm">
                Grand total:{" "}
                <span className="text-lg font-semibold">
                  {currency.format(
                    isMonthlyBudget ? monthTotals[budgetMonth - 1] : grandTotal
                  )}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>
            Optional supporting files (Excel, PDF, images…), up to 15 MB each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input type="file" name="files" multiple />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="outline"
          disabled={pending || Boolean(existingMonthlyBudget)}
        >
          Save draft
        </Button>
        <Button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending || Boolean(existingMonthlyBudget)}
        >
          {pending ? "Saving…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
