import Link from "next/link";
import { ArrowRight, CalendarDays, Wallet } from "lucide-react";
import { FormHeader } from "@/components/form-header";
import { ReportForm } from "@/components/report-form";
import {
  Card,
  CardContent,
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
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <FormHeader
          eyebrow="New report"
          title={
            type === "budget"
              ? "Monthly budget report"
              : "Monthly activity report"
          }
        />
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
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="space-y-2">
        <h1 className="type-title">New report</h1>
        <p className="type-subtitle">Pick the kind of report you are filing.</p>
      </header>
      {/* Each option is one link with one target, and says what starting it
          leads to. The old cards had a hover colour on a border they did not
          draw, so nothing answered the pointer and they read as text. */}
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {[
          {
            href: "/reports/new?type=budget",
            icon: Wallet,
            title: "Monthly budget report",
            description:
              "One month's actual expenses, in sections you name. Once reviewed, it counts towards the annual budget.",
            action: "Start a budget report",
          },
          {
            href: "/reports/new?type=monthly",
            icon: CalendarDays,
            title: "Monthly activity report",
            description:
              "What your team did this month, written up section by section, with any documents attached.",
            action: "Start an activity report",
          },
        ].map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="h-full rounded-[1.25rem] shadow-none ring-0 transition-[background-color,transform] duration-200 group-hover:bg-[color-mix(in_oklab,var(--card),var(--foreground)_3%)] group-active:scale-[0.99] group-active:duration-100 motion-reduce:group-active:scale-100">
              <CardHeader className="flex-1 gap-2">
                <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <option.icon className="size-6" aria-hidden />
                </span>
                <CardTitle className="font-heading text-[1.25rem] leading-tight font-semibold tracking-[-0.012em]">
                  {option.title}
                </CardTitle>
                <CardDescription className="type-callout">
                  {option.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="type-callout inline-flex items-center gap-1 font-semibold text-primary">
                  {option.action}
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="type-callout max-w-3xl text-muted-foreground">
        You can save it as a draft and come back to it. Once you submit it, a
        reviewer marks it as reviewed or sends it back with feedback.
      </p>
    </div>
  );
}
