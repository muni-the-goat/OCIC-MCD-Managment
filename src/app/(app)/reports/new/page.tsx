import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import { ReportForm } from "@/components/report-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import {
  canManageAnyReport,
  getProfile,
  livesOnProjectsOnly,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FiledPeriod } from "@/lib/submit-check";
import type { BudgetHistoryReport, BudgetItem } from "@/lib/types";

export const metadata = { title: "New report" };

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;

  // Hiding the two cards would not be enough — /reports/new?type=budget is a
  // URL anyone can type. The Vice President and their Assistant file the
  // project monthly report and nothing else, so this sends them there rather
  // than to a form whose Server Action would refuse them at the end.
  const me = await getProfile();
  if (livesOnProjectsOnly(me.role)) redirect("/projects/new");

  if (type === "budget" || type === "monthly") {
    const supabase = await createClient();
    let budgetHistory: BudgetHistoryReport[] = [];

    // Every period this author has already filed for this kind of report, so
    // the check before submitting can say when a month is being used twice.
    // Deliberately not the same query as budgetHistory: that one drags all the
    // line items along to seed the form, and this one wants six columns.
    const { data: filed } = await supabase
      .from("reports")
      .select("id, title, type, budget_period, period_month, period_year")
      .eq("author_id", me.id)
      .eq("type", type)
      .limit(300);

    if (type === "budget") {
      const { data } = await supabase
        .from("reports")
        .select(
          "id, title, status, period_month, period_year, updated_at, items:budget_items(*)"
        )
        .eq("author_id", me.id)
        .eq("type", "budget")
        .eq("budget_period", "monthly")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(60);

      budgetHistory = (data ?? []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        status: entry.status,
        period_month: entry.period_month,
        period_year: entry.period_year,
        updated_at: entry.updated_at,
        items: ((entry.items ?? []) as BudgetItem[]).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      }));
    }

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          New {type} report
        </h1>
        <ReportForm
          type={type}
          budgetHistory={budgetHistory}
          filedPeriods={(filed ?? []) as FiledPeriod[]}
          locksOnSubmit={!canManageAnyReport(me.role)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New report</h1>
        <p className="text-sm text-muted-foreground">
          Choose the kind of report you want to create.
        </p>
      </div>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link href="/reports/new?type=budget">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <Wallet className="mb-2 size-8 text-primary" />
              <CardTitle>Monthly budget report</CardTitle>
              <CardDescription>
                Monthly actual expenses with freeform sections and automatic
                subtotals. Reviewed reports update the annual dashboard.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/reports/new?type=monthly">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CalendarDays className="mb-2 size-8 text-primary" />
              <CardTitle>Monthly activity report</CardTitle>
              <CardDescription>
                What the month held, written up section by section, plus any
                supporting documents you attach.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
