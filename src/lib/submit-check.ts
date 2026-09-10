import {
  reportPeriodLabel,
  reportTypeLabel,
  type BudgetPeriod,
  type ReportType,
} from "@/lib/types";

// What the form shows you the moment before it files a report.
//
// Written after a real one went wrong: a budget report titled "Digital — July
// 2026" was filed under August, because the month picker starts on the current
// month and actuals are written up after the month they cover. Nothing on the
// page contradicted the title, so it was invisible until the numbers landed in
// the wrong bucket weeks later.
//
// The month is therefore what this leads with — not the title, which is free
// text nobody can check, and not a general "are you sure?", which teaches
// people to click through. It states the one field that decides where the
// money lands, next to the figure that will land there.

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// A report this author has already filed, for the duplicate check.
export interface FiledPeriod {
  id: string;
  title: string;
  type: ReportType;
  budget_period: BudgetPeriod;
  period_month: number;
  period_year: number;
}

export interface SubmitCheckInput {
  type: ReportType;
  budgetPeriod: BudgetPeriod;
  month: number;
  year: number;
  title: string;
  // The figure for the month being filed. Budget reports only; null elsewhere.
  monthTotal: number | null;
  filed: FiledPeriod[];
  // Null while the report is still being created.
  currentReportId: string | null;
  // Whether submitting takes this author's ability to edit it away.
  locked: boolean;
}

export interface SubmitCheck {
  kind: string;
  period: string;
  title: string;
  amount: string | null;
  duplicate: FiledPeriod | null;
  locked: boolean;
  // True when the report says nothing about money at all. Filing a budget
  // report of zero is legitimate but rare enough to be worth a second look.
  empty: boolean;
}

// An annual budget report covers a year and parks period_month at 1, so
// comparing months would make every annual report a duplicate of every other.
function samePeriod(a: FiledPeriod, month: number, year: number) {
  if (a.period_year !== year) return false;
  return a.budget_period === "annual" ? true : a.period_month === month;
}

export function buildSubmitCheck({
  type,
  budgetPeriod,
  month,
  year,
  title,
  monthTotal,
  filed,
  currentReportId,
  locked,
}: SubmitCheckInput): SubmitCheck {
  const duplicate =
    filed.find(
      (entry) =>
        entry.id !== currentReportId &&
        entry.type === type &&
        entry.budget_period === budgetPeriod &&
        samePeriod(entry, month, year)
    ) ?? null;

  return {
    kind: reportTypeLabel(type, budgetPeriod),
    period: reportPeriodLabel(type, month, year, budgetPeriod),
    title: title.trim(),
    amount: monthTotal === null ? null : money.format(monthTotal),
    duplicate,
    locked,
    empty: monthTotal === 0,
  };
}
