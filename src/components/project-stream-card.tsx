import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ALL_SELECTION,
  bandItems,
  compareYears,
  type CategorySelection,
  currency,
  groupIntoBands,
  hasNamedProperties,
  monthTotals,
  propertyGroups,
  reportedMonths,
  showsGrandTotal,
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
  selection = ALL_SELECTION,
}: {
  stream: ProjectStream;
  year: number;
  current: ProjectReport | null;
  previous: ProjectReport | null;
  // The rows are already narrowed to the selection by the time they arrive;
  // this is what tells the table which columns to keep. Asked for Commercial,
  // it drops House and Condo rather than ruling three columns of dashes.
  selection?: CategorySelection;
}) {
  const items = current?.items ?? [];
  const tracksUnits = streamTracksUnits(stream);
  const months = reportedMonths(items);
  const totals = yearTotals(items);
  const bands = groupIntoBands(items, selection);
  const showsTotal = showsGrandTotal(bands);
  const comparison = previous ? compareYears(items, previous.items) : null;
  const properties = hasNamedProperties(items) ? propertyGroups(items) : [];
  // With one month reported, a year column would repeat that month exactly.
  const showsYearColumn = months.length > 1;
  const columns = 1 + months.length + (showsYearColumn ? 1 : 0);

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
        {/* Months across the top, categories down the side — the way the
            office reads a monthly report, and the same shape as the by-property
            table beneath it. A category with nothing in it still gets its row
            of em dashes, because the rows are meant to be the same on every
            table: one that changes between projects is one you re-read each
            time.

            Scrolls inside its own box rather than pushing the page sideways,
            with the category column pinned so scrolling right never leaves you
            looking at a row you can no longer name. */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              {projectStreamLabel(stream)} {year}, by category and month
              {tracksUnits ? ", with unit counts" : ""}
            </caption>
            <thead>
              <tr className="bg-muted/50">
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b bg-muted px-3 py-2 text-left font-medium"
                >
                  Category
                </th>
                {months.map((monthIndex) => (
                  <th
                    key={monthIndex}
                    scope="col"
                    className="border-b border-l px-4 py-2 text-right font-medium whitespace-nowrap"
                  >
                    {MONTH_SHORT[monthIndex]} {year}
                  </th>
                ))}
                {showsYearColumn ? (
                  <th
                    scope="col"
                    className="border-b border-l-2 px-4 py-2 text-right font-medium"
                  >
                    Total
                  </th>
                ) : null}
              </tr>
            </thead>
            {bands.map((band) => (
              <tbody key={band.label}>
                {/* A band of one column named after itself — Land — would head
                    its own single row with the same word. */}
                {band.selfNamed ? null : (
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={columns}
                      className="sticky left-0 border-b bg-muted/40 px-3 py-1.5 text-left font-label text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {band.label}
                    </th>
                  </tr>
                )}
                {band.columns.map((column) => (
                  <tr key={column.label} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-normal whitespace-nowrap group-hover:bg-muted/40"
                    >
                      {column.label}
                    </th>
                    {months.map((monthIndex) => (
                      <td
                        key={monthIndex}
                        className="border-b border-l px-4 py-2.5 text-right group-hover:bg-muted/40"
                      >
                        <Figure
                          {...monthTotals(column.items, monthIndex)}
                          showUnits={tracksUnits}
                        />
                      </td>
                    ))}
                    {showsYearColumn ? (
                      <td className="border-b border-l-2 bg-muted/20 px-4 py-2.5 text-right group-hover:bg-muted/40">
                        <Figure
                          {...yearTotals(column.items)}
                          showUnits={tracksUnits}
                          strong
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
                {band.showSubtotal ? (
                  <tr className="group bg-muted/20">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b bg-muted/40 px-3 py-2.5 text-left font-medium whitespace-nowrap"
                    >
                      {band.label} total
                    </th>
                    {months.map((monthIndex) => (
                      <td
                        key={monthIndex}
                        className="border-b border-l px-4 py-2.5 text-right"
                      >
                        <Figure
                          {...monthTotals(bandItems(band), monthIndex)}
                          showUnits={tracksUnits}
                          strong
                        />
                      </td>
                    ))}
                    {showsYearColumn ? (
                      <td className="border-b border-l-2 px-4 py-2.5 text-right">
                        <Figure
                          {...yearTotals(bandItems(band))}
                          showUnits={tracksUnits}
                          strong
                        />
                      </td>
                    ) : null}
                  </tr>
                ) : null}
              </tbody>
            ))}
            {showsTotal ? (
              <tfoot>
                <tr className="bg-muted/50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t-2 bg-muted px-3 py-2.5 text-left font-medium"
                  >
                    Total
                  </th>
                  {months.map((monthIndex) => (
                    <td
                      key={monthIndex}
                      className="border-t-2 border-l px-4 py-2.5 text-right"
                    >
                      <Figure
                        {...monthTotals(items, monthIndex)}
                        showUnits={tracksUnits}
                        strong
                      />
                    </td>
                  ))}
                  {showsYearColumn ? (
                    <td className="border-t-2 border-l-2 px-4 py-2.5 text-right">
                      <Figure
                        amount={totals.amount}
                        units={totals.units}
                        showUnits={tracksUnits}
                        strong
                      />
                    </td>
                  ) : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {/* The table above says how much land and how much built. This says
            which building — the figures those category columns are made of,
            read down the page rather than across it, so a project can take on
            another property without the table growing sideways. */}
        {properties.length > 0 ? (
          <div className="space-y-2">
            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
              By property
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
                <caption className="sr-only">
                  {projectStreamLabel(stream)} {year}, by property and month
                </caption>
                <thead>
                  <tr className="bg-muted/50">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 border-b bg-muted px-3 py-2 text-left font-medium"
                    >
                      Property
                    </th>
                    {months.map((monthIndex) => (
                      <th
                        key={monthIndex}
                        scope="col"
                        className="border-b border-l px-4 py-2 text-right font-medium whitespace-nowrap"
                      >
                        {MONTH_SHORT[monthIndex]}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="border-b border-l-2 px-4 py-2 text-right font-medium"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                {properties.map((propertyGroup) => (
                  <tbody key={propertyGroup.category}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={months.length + 2}
                        className="sticky left-0 border-b bg-muted/40 px-3 py-1.5 text-left font-label text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {propertyGroup.category}
                      </th>
                    </tr>
                    {propertyGroup.items.map((item) => (
                      <tr key={item.id} className="group">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-normal whitespace-nowrap group-hover:bg-muted/40"
                        >
                          {item.name}
                        </th>
                        {months.map((monthIndex) => (
                          <td
                            key={monthIndex}
                            className="border-b border-l px-4 py-2.5 text-right group-hover:bg-muted/40"
                          >
                            <Figure
                              {...monthTotals([item], monthIndex)}
                              showUnits={tracksUnits}
                            />
                          </td>
                        ))}
                        <td className="border-b border-l-2 bg-muted/20 px-4 py-2.5 text-right group-hover:bg-muted/40">
                          <Figure
                            {...yearTotals([item])}
                            showUnits={tracksUnits}
                            strong
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        ) : null}

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
