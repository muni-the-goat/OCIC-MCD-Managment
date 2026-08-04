import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  compareYears,
  currency,
  monthTotals,
  reportedMonths,
  yearTotals,
} from "@/lib/project-reports";
import { cn } from "@/lib/utils";
import {
  MONTH_KEYS,
  MONTH_SHORT,
  UNIT_KEYS,
  itemTotal,
  itemUnitTotal,
  projectStreamLabel,
  streamTracksUnits,
  type ProjectReport,
  type ProjectStream,
} from "@/lib/types";

const DESCRIPTIONS: Record<ProjectStream, string> = {
  sales:
    "Units sold and their value across Koh Pich, Airway Complex, KSP and Cross Department.",
  leasing: "Leasing income by property.",
  property_management: "Property management income by property.",
};

// An unreported month renders as an em dash, never as $0.00. The distinction is
// the whole reason isReportedMonth() exists: July has not happened yet, and
// showing it as zero income would be a claim rather than a gap.
function Amount({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <>{currency.format(value)}</>
  );
}

function Delta({
  change,
  percent,
  suffix,
}: {
  change: number;
  percent: number | null;
  suffix: string;
}) {
  const flat = change === 0;
  const up = change > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        flat
          ? "text-muted-foreground"
          : up
            ? "text-status-good"
            : "text-status-critical"
      )}
    >
      <Icon className="size-4" aria-hidden />
      {/* The sign is carried by the word as well as the arrow and the colour:
          a rise and a fall must not be distinguishable by hue alone. */}
      <span>
        {flat ? "No change" : `${up ? "Up" : "Down"} ${suffix}`}
        {percent === null ? "" : ` · ${Math.abs(percent).toFixed(1)}%`}
      </span>
    </span>
  );
}

export function ProjectStreamCard({
  stream,
  year,
  current,
  previous,
}: {
  stream: ProjectStream;
  year: number;
  current: ProjectReport | null;
  previous: ProjectReport | null;
}) {
  const items = current?.items ?? [];
  const tracksUnits = streamTracksUnits(stream);
  const months = reportedMonths(items);
  const totals = yearTotals(items);
  const comparison = previous ? compareYears(items, previous.items) : null;

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{projectStreamLabel(stream)}</CardTitle>
          <CardDescription>{DESCRIPTIONS[stream]}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing recorded for {year} yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {year}
        </p>
        <CardTitle>{projectStreamLabel(stream)}</CardTitle>
        <CardDescription>{DESCRIPTIONS[stream]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* The table scrolls inside its own box rather than pushing the page
            sideways — twelve months plus a name column does not fit a laptop,
            and a horizontally scrolling page is a broken page. */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">
              {projectStreamLabel(stream)} {year}, by month
            </caption>
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Month
                </th>
                {items.map((item) => (
                  <th
                    key={item.id}
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    {item.name}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((monthIndex) => {
                const row = monthTotals(items, monthIndex);
                return (
                  <tr key={monthIndex} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="px-3 py-2 text-left font-normal whitespace-nowrap"
                    >
                      {MONTH_SHORT[monthIndex]} {year}
                    </th>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="px-3 py-2 text-right tabular-nums"
                      >
                        <Amount
                          value={Number(item[MONTH_KEYS[monthIndex]] ?? 0)}
                        />
                        {tracksUnits ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {Number(item[UNIT_KEYS[monthIndex]] ?? 0) || "—"}
                            {Number(item[UNIT_KEYS[monthIndex]] ?? 0) === 1
                              ? " unit"
                              : " units"}
                          </span>
                        ) : null}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      <Amount value={row.amount} />
                      {tracksUnits ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {row.units} {row.units === 1 ? "unit" : "units"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-medium">
                <th scope="row" className="px-3 py-2 text-left">
                  Total
                </th>
                {items.map((item) => (
                  <td
                    key={item.id}
                    className="px-3 py-2 text-right tabular-nums"
                  >
                    <Amount value={itemTotal(item)} />
                    {tracksUnits ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {itemUnitTotal(item)}
                      </span>
                    ) : null}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  <Amount value={totals.amount} />
                  {tracksUnits ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {totals.units} {totals.units === 1 ? "unit" : "units"}
                    </span>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {comparison && comparison.months.length > 0 ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {MONTH_SHORT[comparison.months[0]]}–
              {MONTH_SHORT[comparison.months[comparison.months.length - 1]]},{" "}
              {previous?.period_year} against {year}
            </p>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-sm text-muted-foreground">Value</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {currency.format(comparison.current.amount)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    from {currency.format(comparison.previous.amount)}
                  </span>
                </dd>
                <dd className="text-sm">
                  <Delta
                    change={comparison.amountChange}
                    percent={comparison.amountPercent}
                    suffix={currency.format(Math.abs(comparison.amountChange))}
                  />
                </dd>
              </div>
              {tracksUnits ? (
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Units</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {comparison.current.units}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      from {comparison.previous.units}
                    </span>
                  </dd>
                  <dd className="text-sm">
                    <Delta
                      change={comparison.unitChange}
                      percent={comparison.unitPercent}
                      suffix={`${Math.abs(comparison.unitChange)}`}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>
            {/* Stated rather than assumed. The workbook's own comparison block
                was labelled "Jan-May" while summing Jan–June; naming the range
                the figures actually cover is how that stops being possible. */}
            <p className="mt-3 text-xs text-muted-foreground">
              Compares only the months both years have reported —{" "}
              {comparison.months.length}{" "}
              {comparison.months.length === 1 ? "month" : "months"}.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
