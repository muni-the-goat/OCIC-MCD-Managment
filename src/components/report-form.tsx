"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, Plus, Trash2 } from "lucide-react";
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
  MONTH_KEYS,
  MONTH_NAMES,
  MONTH_SHORT,
  type BudgetItem,
  type BudgetPeriod,
  type Report,
  type ReportType,
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

function num(raw: string): number {
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Rebuild grouped sections from the flat budget_items rows (order preserved).
function sectionsFromItems(items: BudgetItem[]): EditSection[] {
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

export function ReportForm({
  type,
  report,
  budgetItems,
}: {
  type: ReportType;
  report?: Report;
  budgetItems?: BudgetItem[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveReport,
    null
  );

  const now = new Date();
  const content = report?.content ?? {};
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>(
    report?.budget_period ?? "monthly"
  );
  const [budgetMonth, setBudgetMonth] = useState(
    report?.period_month ?? now.getMonth() + 1
  );
  const isMonthlyBudget = type === "budget" && budgetPeriod === "monthly";

  const [sections, setSections] = useState<EditSection[]>(() =>
    sectionsFromItems(budgetItems ?? [])
  );

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

  const updateSection = (si: number, patch: Partial<EditSection>) =>
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, ...patch } : s))
    );

  const updateItem = (si: number, ii: number, patch: Partial<EditItem>) =>
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

  const setAmount = (si: number, ii: number, mi: number, value: string) =>
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
      ) : null}

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
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
          {type === "budget" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Reporting period</legend>
              <div className="grid max-w-md grid-cols-2 rounded-lg border bg-muted/30 p-1">
                {(
                  [
                    ["monthly", "Monthly", CalendarDays],
                    ["annual", "Annual", CalendarRange],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={budgetPeriod === value ? "default" : "ghost"}
                    className="gap-2"
                    aria-pressed={budgetPeriod === value}
                    disabled={Boolean(report)}
                    onClick={() => setBudgetPeriod(value)}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {report
                  ? "The reporting period cannot be changed after the report is created."
                  : budgetPeriod === "monthly"
                    ? "Create a separate report for the selected month."
                    : "Use the existing full-year Jan–Dec layout."}
              </p>
            </fieldset>
          ) : null}
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
                  onValueChange={(value) => setBudgetMonth(Number(value))}
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
                  defaultValue={report?.period_year ?? now.getFullYear()}
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
                      onClick={() =>
                        setSections((prev) =>
                          prev.filter((_, i) => i !== si)
                        )
                      }
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
                                  onClick={() =>
                                    updateSection(si, {
                                      items: section.items.filter(
                                        (_, j) => j !== ii
                                      ),
                                    })
                                  }
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
                      onClick={() =>
                        updateSection(si, {
                          items: [...section.items, emptyItem()],
                        })
                      }
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
                onClick={() =>
                  setSections((prev) => [
                    ...prev,
                    { name: "", items: [emptyItem()] },
                  ])
                }
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
          disabled={pending}
        >
          Save draft
        </Button>
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          {pending ? "Saving…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
