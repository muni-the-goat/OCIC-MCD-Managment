import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import { ReportForm } from "@/components/report-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "New report" };

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;

  if (type === "budget" || type === "monthly") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          New {type} report
        </h1>
        <ReportForm type={type} />
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
              <CardTitle>Budget report</CardTitle>
              <CardDescription>
                Monthly or annual actual expenses with freeform sections and
                automatic subtotals.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/reports/new?type=monthly">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CalendarDays className="mb-2 size-8 text-primary" />
              <CardTitle>Monthly report</CardTitle>
              <CardDescription>
                Structured sections: summary, accomplishments, challenges, and
                next month&apos;s plan.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
