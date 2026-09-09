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
  type LineTotals,
  lineTotals,
  monthRangeLabel,
  propertyGroups,
  reportedMonths,
  showsGrandTotal,
} from "@/lib/project-reports";
import { cn } from "@/lib/utils";
import {
  MONTH_SHORT,
  projectStreamLabelFor,
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

// Every table on this card is laid out to the same grid, which is what lets the
// two main ones share a scroll box and sit their months over one another.
// Fixed layout rather than auto, because a column that sizes itself to its own
// contents is a column that lands somewhere different on each table.
const LABEL_WIDTH = 192;
const MONTH_WIDTH = 136;

function tableWidth(months: readonly number[], showsTotalColumn: boolean) {
  return LABEL_WIDTH + (months.length + (showsTotalColumn ? 1 : 0)) * MONTH_WIDTH;
}

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

// The same cell for a month of the year-on-year row, where zero means something
// different.
//
// Figure() draws a zero as an em dash because an unreported month is not a
// month that earned nothing. On a change row the reading flips: two years that
// both reported and landed on the same figure is a real answer — "no change" —
// and a dash there would hide it. So the dash is kept only for a month neither
// year reported, and everything else carries its sign.
//
// The sign is in the text as well as the colour, so a rise and a fall are not
// distinguishable by hue alone.
function ChangeFigure({
  current,
  previous,
  showUnits,
}: {
  current: { amount: number; units: number };
  previous: { amount: number; units: number };
  showUnits: boolean;
}) {
  const reported =
    current.amount !== 0 ||
    current.units !== 0 ||
    previous.amount !== 0 ||
    previous.units !== 0;
  if (!reported) return <span className="text-muted-foreground">—</span>;

  const amount = current.amount - previous.amount;
  const units = current.units - previous.units;
  const sign = (value: number) => (value > 0 ? "+" : value < 0 ? "−" : "");

  return (
    <span
      className={cn(
        "flex flex-col items-end leading-tight tabular-nums",
        amount === 0
          ? "text-muted-foreground"
          : amount > 0
            ? "text-status-good"
            : "text-status-critical"
      )}
    >
      <span className="font-medium">
        {sign(amount)}
        {currency.format(Math.abs(amount))}
      </span>
      {showUnits ? (
        <span className="text-xs">
          {units === 0
            ? "no change"
            : `${sign(units)}${Math.abs(units)} ${
                Math.abs(units) === 1 ? "unit" : "units"
              }`}
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

// The head of any of the tables on this card: the row-heading column, then a
// column per month, then the Total. One component because the three tables read
// across identically and had already drifted apart when they were written out
// three times — one headed its months "Jan 2026" and another "Jan".
function MonthHead({
  rowHeading,
  months,
  showsTotalColumn,
}: {
  rowHeading: string;
  months: readonly number[];
  showsTotalColumn: boolean;
}) {
  return (
    <thead>
      <tr className="bg-table-header">
        <th
          scope="col"
          className="sticky left-0 z-10 border-b bg-table-header px-3 py-2 text-left font-medium"
        >
          {rowHeading}
        </th>
        {/* The month alone. The card's eyebrow already states the period, so
            repeating the year in every column head spent the width the figures
            need on a word the reader has just read. */}
        {months.map((monthIndex) => (
          <th
            key={monthIndex}
            scope="col"
            className="border-b border-l px-4 py-2 text-right font-medium whitespace-nowrap"
          >
            {MONTH_SHORT[monthIndex]}
          </th>
        ))}
        {showsTotalColumn ? (
          <th
            scope="col"
            className="border-b border-l-2 px-4 py-2 text-right font-medium"
          >
            Total
          </th>
        ) : null}
      </tr>
    </thead>
  );
}

// The same widths on every table, which is the whole of what keeps their
// columns over one another inside a shared scroll box.
function MonthCols({
  months,
  showsTotalColumn,
}: {
  months: readonly number[];
  showsTotalColumn: boolean;
}) {
  return (
    <colgroup>
      <col style={{ width: LABEL_WIDTH }} />
      {months.map((monthIndex) => (
        <col key={monthIndex} style={{ width: MONTH_WIDTH }} />
      ))}
      {showsTotalColumn ? <col style={{ width: MONTH_WIDTH }} /> : null}
    </colgroup>
  );
}

// A line of a table, with its figures already added up. Both main tables are
// built as this shape before any of it is drawn, which is what lets the markup
// below index into an array rather than re-running the arithmetic in every cell.
interface TableLine {
  key: string;
  label: string;
  subtotal: boolean;
  totals: LineTotals;
}

interface TableSection {
  key: string;
  // The band, or the category a group of properties is filed under. Null for a
  // band of one column named after itself — Land would head its own single row
  // with the same word.
  heading: string | null;
  lines: TableLine[];
}

// Months across the top, rows down the side — the way the office reads a
// monthly report. A category with nothing in it still gets its row of em
// dashes, because the rows are meant to be the same on every table: one that
// changes between projects is one you re-read each time.
function FigureTable({
  caption,
  rowHeading,
  months,
  showsTotalColumn,
  showUnits,
  sections,
  footer,
}: {
  caption: string;
  rowHeading: string;
  months: readonly number[];
  showsTotalColumn: boolean;
  showUnits: boolean;
  sections: readonly TableSection[];
  footer?: TableLine;
}) {
  const columns = 1 + months.length + (showsTotalColumn ? 1 : 0);

  return (
    <table
      className="w-full table-fixed border-separate border-spacing-0 text-sm"
      style={{ minWidth: tableWidth(months, showsTotalColumn) }}
    >
      <caption className="sr-only">{caption}</caption>
      <MonthCols months={months} showsTotalColumn={showsTotalColumn} />
      <MonthHead
        rowHeading={rowHeading}
        months={months}
        showsTotalColumn={showsTotalColumn}
      />
      {sections.map((section) => (
        <tbody key={section.key}>
          {section.heading === null ? null : (
            <tr>
              <th
                scope="colgroup"
                colSpan={columns}
                className="sticky left-0 z-10 border-b bg-table-band px-3 py-1.5 text-left font-label text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {section.heading}
              </th>
            </tr>
          )}
          {section.lines.map((line) => (
            <tr
              key={line.key}
              className={cn("group", line.subtotal && "bg-table-subtotal")}
            >
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 border-b px-3 py-2.5 text-left",
                  line.subtotal
                    ? "border-t bg-table-subtotal font-medium whitespace-nowrap"
                    : "bg-card font-normal group-hover:bg-muted/40"
                )}
              >
                {line.label}
              </th>
              {line.totals.cells.map((cell, slot) => (
                <td
                  key={months[slot]}
                  className={cn(
                    "border-b border-l px-4 py-2.5 text-right",
                    line.subtotal ? "border-t" : "group-hover:bg-muted/40"
                  )}
                >
                  <Figure
                    amount={cell.amount}
                    units={cell.units}
                    showUnits={showUnits}
                    strong={line.subtotal}
                  />
                </td>
              ))}
              {showsTotalColumn ? (
                <td
                  className={cn(
                    "border-b border-l-2 px-4 py-2.5 text-right",
                    line.subtotal
                      ? "border-t"
                      : "bg-muted/20 group-hover:bg-muted/40"
                  )}
                >
                  <Figure
                    amount={line.totals.total.amount}
                    units={line.totals.total.units}
                    showUnits={showUnits}
                    strong
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      ))}
      {footer ? (
        <tfoot>
          <tr className="bg-table-total text-table-total-foreground">
            <th
              scope="row"
              className="sticky left-0 z-10 border-t-2 border-t-table-total-edge bg-table-total px-3 py-2.5 text-left font-semibold"
            >
              {footer.label}
            </th>
            {footer.totals.cells.map((cell, slot) => (
              <td
                key={months[slot]}
                className="border-t-2 border-t-table-total-edge border-l px-4 py-2.5 text-right"
              >
                <Figure
                  amount={cell.amount}
                  units={cell.units}
                  showUnits={showUnits}
                  strong
                />
              </td>
            ))}
            {showsTotalColumn ? (
              <td className="border-t-2 border-t-table-total-edge border-l-2 px-4 py-2.5 text-right">
                <Figure
                  amount={footer.totals.total.amount}
                  units={footer.totals.total.units}
                  showUnits={showUnits}
                  strong
                />
              </td>
            ) : null}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

// The two years laid out month against month.
//
// The block above this states one pair of figures — this year's total against
// last year's — and that answers "are we ahead" without answering "where". A
// year that finished $40,342 up can be one that was behind every month until
// August, and the summary and the arrow beside it say exactly the same thing
// about both. This is the row of months underneath it, which is what somebody
// asking the question a second time is actually asking for.
//
// Its axis is every month *either* year reported, not the months they share.
// That is deliberately not the axis the summary uses, and the note under the
// table says so: last December belongs on a comparison of the two years even
// though this year has no December to set against it, and leaving it off would
// make the table describe a shorter year than the one that happened.
function YearComparisonTable({
  caption,
  months,
  currentYear,
  previousYear,
  current,
  previous,
  showUnits,
}: {
  caption: string;
  months: readonly number[];
  currentYear: number;
  previousYear: number;
  current: LineTotals;
  previous: LineTotals;
  showUnits: boolean;
}) {
  const showsTotalColumn = months.length > 1;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table
        className="w-full table-fixed border-separate border-spacing-0 text-sm"
        style={{ minWidth: tableWidth(months, showsTotalColumn) }}
      >
        <caption className="sr-only">{caption}</caption>
        <MonthCols months={months} showsTotalColumn={showsTotalColumn} />
        <MonthHead
          rowHeading="Year"
          months={months}
          showsTotalColumn={showsTotalColumn}
        />
        <tbody>
          {/* This year first, so the pair reads newest-then-what-it-came-from —
              the same order as the figures above, and as the change row's sign,
              which is this year minus last. */}
          {[
            { year: currentYear, totals: current },
            { year: previousYear, totals: previous },
          ].map(({ year, totals }) => (
            <tr key={year} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-medium tabular-nums group-hover:bg-muted/40"
              >
                {year}
              </th>
              {totals.cells.map((cell, slot) => (
                <td
                  key={months[slot]}
                  className="border-b border-l px-4 py-2.5 text-right group-hover:bg-muted/40"
                >
                  <Figure
                    amount={cell.amount}
                    units={cell.units}
                    showUnits={showUnits}
                  />
                </td>
              ))}
              {showsTotalColumn ? (
                <td className="border-b border-l-2 bg-muted/20 px-4 py-2.5 text-right group-hover:bg-muted/40">
                  <Figure
                    amount={totals.total.amount}
                    units={totals.total.units}
                    showUnits={showUnits}
                    strong
                  />
                </td>
              ) : null}
            </tr>
          ))}
          <tr className="bg-table-subtotal">
            <th
              scope="row"
              className="sticky left-0 z-10 border-t border-b bg-table-subtotal px-3 py-2.5 text-left font-medium whitespace-nowrap"
            >
              Change
            </th>
            {current.cells.map((cell, slot) => (
              <td
                key={months[slot]}
                className="border-t border-b border-l px-4 py-2.5 text-right"
              >
                <ChangeFigure
                  current={cell}
                  previous={previous.cells[slot]}
                  showUnits={showUnits}
                />
              </td>
            ))}
            {showsTotalColumn ? (
              <td className="border-t border-b border-l-2 px-4 py-2.5 text-right">
                <ChangeFigure
                  current={current.total}
                  previous={previous.total}
                  showUnits={showUnits}
                />
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ProjectStreamCard({
  projectId,
  stream,
  year,
  period,
  current,
  previous,
  selection = ALL_SELECTION,
}: {
  // Which project's card this is. Only the heading uses it: Chroy Changvar Bay
  // calls its leasing report Commercial, and the label has to know whose report
  // it is sitting above.
  projectId: string;
  stream: ProjectStream;
  year: number;
  // "2026", or "March 2026" once the month filter has been used. The eyebrow
  // and the empty state both name it, so a table showing a single column reads
  // as the month that was asked for rather than as a year gone missing.
  period: string;
  current: ProjectReport | null;
  previous: ProjectReport | null;
  // The rows are already narrowed to the selection by the time they arrive;
  // this is what tells the table which columns to keep. Asked for Commercial,
  // it drops House and Condo rather than ruling three columns of dashes.
  selection?: CategorySelection;
}) {
  const items = current?.items ?? [];
  const previousItems = previous?.items ?? [];
  const tracksUnits = streamTracksUnits(stream);
  const months = reportedMonths(items);
  const bands = groupIntoBands(items, selection);
  const showsTotal = showsGrandTotal(bands);
  const comparison = previous ? compareYears(items, previousItems) : null;
  const properties = hasNamedProperties(items) ? propertyGroups(items) : [];
  // With one month reported, a year column would repeat that month exactly.
  // Every table on the card asks this, so a month-filtered view does not leave
  // one of them ruling a Total that restates the single column beside it.
  const showsYearColumn = months.length > 1;
  const label = projectStreamLabelFor(projectId, stream);

  // No rows at all is a report nobody has filled in; rows with no reported
  // month is a month nothing was filed in — which is what the month filter
  // lands on whenever a project traded in April but not in March. Both read as
  // the same empty card, and the period is what tells them apart.
  if (items.length === 0 || months.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{DESCRIPTIONS[stream]}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing recorded for {period} yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Every figure on both tables, added up once. See lineTotals() in
  // project-reports.ts for what this replaced.
  const categorySections: TableSection[] = bands.map((band) => {
    const rows = band.columns.map((column) => ({
      key: column.label,
      label: column.label,
      subtotal: false,
      totals: lineTotals(column.items, months),
    }));
    return {
      key: band.label,
      heading: band.selfNamed ? null : band.label,
      lines: band.showSubtotal
        ? [
            ...rows,
            {
              key: `${band.label} total`,
              label: `${band.label} total`,
              subtotal: true,
              totals: lineTotals(bandItems(band), months),
            },
          ]
        : rows,
    };
  });

  const propertySections: TableSection[] = properties.map((group) => ({
    key: group.category,
    heading: group.category,
    lines: group.items.map((item) => ({
      key: item.id,
      label: item.name,
      subtotal: false,
      totals: lineTotals([item], months),
    })),
  }));

  // Every month either year has, so December of last year keeps its column even
  // though this year has not reached it. A month neither year reported is not
  // on the axis at all — that is a gap in the calendar, not in the data.
  const comparisonMonths = previous
    ? [
        ...new Set([...reportedMonths(items), ...reportedMonths(previousItems)]),
      ].sort((a, b) => a - b)
    : [];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {period}
        </p>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{DESCRIPTIONS[stream]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* One scroll box, both tables.

            They were a box each, and because each sized its own columns the
            same month sat at two different places across them — so scrolling
            one out to December left the other still showing January. Sharing
            the box and the column widths makes the second table the
            continuation of the first, which is what it has always been: the
            summary says how much land and how much built, this says which
            building.

            The row heading stays pinned while the months scroll under it, so
            scrolling right never leaves you looking at a figure you can no
            longer name. */}
        <div className="overflow-x-auto rounded-lg border">
          <FigureTable
            caption={`${label} ${year}, by category and month${
              tracksUnits ? ", with unit counts" : ""
            }`}
            rowHeading="Category"
            months={months}
            showsTotalColumn={showsYearColumn}
            showUnits={tracksUnits}
            sections={categorySections}
            footer={
              showsTotal
                ? {
                    key: "total",
                    label: "Total",
                    subtotal: false,
                    totals: lineTotals(items, months),
                  }
                : undefined
            }
          />

          {propertySections.length > 0 ? (
            <>
              {/* Spans the scrolled width rather than the visible one, so the
                  strip does not stop short when the tables are scrolled right.
                  Its words are pinned left for the same reason the row headings
                  are. */}
              <div
                className="border-y bg-table-band px-3 py-2"
                style={{ minWidth: tableWidth(months, showsYearColumn) }}
              >
                <span className="sticky left-3 font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  By property
                </span>
              </div>
              <FigureTable
                caption={`${label} ${year}, by property and month`}
                rowHeading="Property"
                months={months}
                showsTotalColumn={showsYearColumn}
                showUnits={tracksUnits}
                sections={propertySections}
              />
            </>
          ) : null}
        </div>

        {comparison && comparison.months.length > 0 && previous ? (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
            <div>
              <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {/* Says what the block is, in the words someone would use for
                    it. It read "Jan–Aug, 2026 against 2025", which front-loaded
                    a month range to qualify a comparison the reader had not
                    been told about yet — and "against" is a word about the
                    figures rather than about what they are for. The range is
                    still stated, underneath, where it qualifies something.

                    Current year first, because the figures below it read
                    "$16,100,267.00 from $24,060,326.00" — newest, then what it
                    came from. Naming the years the other way round made the
                    heading contradict the sentence directly under it. */}
                Comparison between {year} and {previous.period_year}
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
                      suffix={currency.format(
                        Math.abs(comparison.amountChange)
                      )}
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
            </div>

            <YearComparisonTable
              caption={`${label}, ${year} against ${previous.period_year} by month`}
              months={comparisonMonths}
              currentYear={year}
              previousYear={previous.period_year}
              current={lineTotals(items, comparisonMonths)}
              previous={lineTotals(previousItems, comparisonMonths)}
              showUnits={tracksUnits}
            />

            {/* Stated rather than assumed, and stating two things, because the
                figures and the table deliberately do not cover the same months.
                The workbook's own comparison was labelled "Jan-May" while
                summing Jan–June; naming what each figure actually covers is how
                that stops being possible.

                This is also where the month range went when the heading above
                stopped carrying it. A range is a qualification, and it belongs
                next to the thing it qualifies rather than in front of it. */}
            <p className="text-xs text-muted-foreground">
              The figures above compare {monthRangeLabel(comparison.months)} —{" "}
              {comparison.months.length === 1
                ? "the only month"
                : `the ${comparison.months.length} months`}{" "}
              both years have reported. The table shows every month either year
              has, so its totals can run ahead of them.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
