import { Fragment } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  bandColumnCount,
  bandItems,
  compareYears,
  currency,
  groupIntoBands,
  monthTotals,
  reportedMonths,
  yearTotals,
} from "@/lib/project-reports";
import { cn } from "@/lib/utils";
import {
  MONTH_SHORT,
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

// One cell of the table.
//
// The amount and the unit count used to sit side by side on one line, and the
// table was unreadable for it. Two reasons, and the second is the one that
// actually mattered: the pair competed for the same glance, and — because "1
// unit" and "11 units" are different widths — the trailing text shoved every
// dollar figure to a different horizontal position. A column of right-aligned
// currency whose decimal points do not line up cannot be compared down its own
// length, which is the only thing a monthly table is for.
//
// So they are stacked instead. The amount keeps the baseline and the alignment;
// the count sits beneath it, smaller and quieter, present when wanted and out
// of the way when not.
//
// An unreported month is a single em dash for the whole cell, not a dash *and*
// an empty unit count — "— — units" was three glyphs to say nothing twice.
// Zero is never rendered as $0.00: July has not happened yet, and showing it as
// no income would be a claim rather than a gap.
function Figure({
  amount,
  units,
  showUnits,
  strong,
}: {
  amount: number;
  units: number;
  showUnits: boolean;
  strong?: boolean;
}) {
  if (amount === 0 && units === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={cn("tabular-nums", strong && "font-semibold")}>
        {currency.format(amount)}
      </span>
      {showUnits ? (
        <span className="text-xs tabular-nums text-muted-foreground">
          {units} {units === 1 ? "unit" : "units"}
        </span>
      ) : null}
    </span>
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
  const bands = groupIntoBands(items);
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
        {/* Two header rows: Land and Built properties across the top, the
            categories inside each one beneath. The Elysee is not a column in
            its own right — it is a building, inside a category, inside a band —
            and a table with a column per building is one nobody reads across.

            A category with nothing under it still gets a column of em dashes,
            because the headings are meant to be the same on every table: a
            header that changes between projects is one you re-read each time.

            Scrolls inside its own box rather than pushing the page sideways,
            with the month column pinned so scrolling right never leaves you
            looking at a row you can no longer name. */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              {projectStreamLabel(stream)} {year}, by month and category
              {tracksUnits ? ", with unit counts" : ""}
            </caption>
            <thead>
              <tr className="bg-muted/50">
                <th
                  scope="col"
                  rowSpan={2}
                  className="sticky left-0 z-10 border-b bg-muted px-3 py-2 text-left align-bottom font-medium"
                >
                  Month
                </th>
                {bands.map((band) => (
                  <th
                    key={band.label}
                    scope="colgroup"
                    colSpan={bandColumnCount(band)}
                    className="border-b border-l px-4 py-2 text-center font-medium whitespace-nowrap"
                  >
                    {band.label}
                  </th>
                ))}
                <th
                  scope="col"
                  rowSpan={2}
                  className="border-b border-l-2 px-4 py-2 text-right align-bottom font-medium"
                >
                  Total
                </th>
              </tr>
              <tr className="bg-muted/50">
                {bands.map((band) =>
                  band.selfNamed ? (
                    // Land, and any band standing on its own: the heading above
                    // already names the one column under it.
                    <th
                      key={band.label}
                      scope="col"
                      className="border-b border-l px-4 pb-2 text-right text-xs font-normal text-muted-foreground"
                    />
                  ) : (
                    <Fragment key={band.label}>
                      {band.columns.map((column, index) => (
                        <th
                          key={column.label}
                          scope="col"
                          className={cn(
                            "border-b px-4 pb-2 text-right text-xs font-normal whitespace-nowrap",
                            index === 0 && "border-l"
                          )}
                        >
                          {column.label}
                        </th>
                      ))}
                      {band.showSubtotal ? (
                        <th
                          scope="col"
                          className="border-b bg-muted/40 px-4 pb-2 text-right text-xs font-medium whitespace-nowrap"
                        >
                          Subtotal
                        </th>
                      ) : null}
                    </Fragment>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {months.map((monthIndex) => {
                const row = monthTotals(items, monthIndex);
                return (
                  <tr key={monthIndex} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-normal whitespace-nowrap group-hover:bg-muted/40"
                    >
                      {MONTH_SHORT[monthIndex]} {year}
                    </th>
                    {bands.map((band) => (
                      <Fragment key={band.label}>
                        {band.columns.map((column, index) => (
                          <td
                            key={column.label}
                            className={cn(
                              "border-b px-4 py-2.5 text-right group-hover:bg-muted/40",
                              index === 0 && "border-l"
                            )}
                          >
                            <Figure
                              {...monthTotals(column.items, monthIndex)}
                              showUnits={tracksUnits}
                            />
                          </td>
                        ))}
                        {band.showSubtotal ? (
                          <td className="border-b bg-muted/20 px-4 py-2.5 text-right group-hover:bg-muted/40">
                            <Figure
                              {...monthTotals(bandItems(band), monthIndex)}
                              showUnits={tracksUnits}
                              strong
                            />
                          </td>
                        ) : null}
                      </Fragment>
                    ))}
                    <td className="border-b border-l-2 bg-muted/20 px-4 py-2.5 text-right group-hover:bg-muted/40">
                      <Figure
                        amount={row.amount}
                        units={row.units}
                        showUnits={tracksUnits}
                        strong
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-t-2 bg-muted px-3 py-2.5 text-left font-medium"
                >
                  Total
                </th>
                {bands.map((band) => (
                  <Fragment key={band.label}>
                    {band.columns.map((column, index) => (
                      <td
                        key={column.label}
                        className={cn(
                          "border-t-2 px-4 py-2.5 text-right",
                          index === 0 && "border-l"
                        )}
                      >
                        <Figure
                          {...yearTotals(column.items)}
                          showUnits={tracksUnits}
                          strong
                        />
                      </td>
                    ))}
                    {band.showSubtotal ? (
                      <td className="border-t-2 bg-muted/40 px-4 py-2.5 text-right">
                        <Figure
                          {...yearTotals(bandItems(band))}
                          showUnits={tracksUnits}
                          strong
                        />
                      </td>
                    ) : null}
                  </Fragment>
                ))}
                <td className="border-t-2 border-l-2 px-4 py-2.5 text-right">
                  <Figure
                    amount={totals.amount}
                    units={totals.units}
                    showUnits={tracksUnits}
                    strong
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {comparison && comparison.months.length > 0 ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {/* Current year first, because the figures below it read
                  "$16,100,267.00 from $24,060,326.00" — newest, then what it
                  came from. Naming the years the other way round made the
                  heading contradict the sentence directly under it. */}
              {MONTH_SHORT[comparison.months[0]]}–
              {MONTH_SHORT[comparison.months[comparison.months.length - 1]]},{" "}
              {year} against {previous?.period_year}
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
