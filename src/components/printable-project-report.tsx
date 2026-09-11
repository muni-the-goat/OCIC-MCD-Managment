import { OcicLogo } from "@/components/ocic-logo";
import { Fragment } from "react";
import {
  ALL_SELECTION,
  bandItems,
  compareYears,
  type CategorySelection,
  currency,
  groupIntoBands,
  hasNamedProperties,
  monthRangeLabel,
  lineTotals,
  monthTotals,
  propertyGroups,
  reportedMonths,
  showsGrandTotal,
  yearTotals,
  type ProjectRecord,
  type StreamTotals,
} from "@/lib/project-reports";
import {
  MONTH_NAMES,
  projectStreamLabelFor,
  streamTracksUnits,
  type ProjectReport,
  type ProjectStream,
} from "@/lib/types";

// The projects print document. Same machinery as PrintableAnnualBudget — the
// `print-only` class, the letterhead, the `print-table` rules in globals.css —
// so the two PDFs come out of the same house rather than looking like documents
// from two companies.
//
// The wording is where they differ, and deliberately. The MCD export is an
// internal record a department files about itself: "Reviewed expenses". This one
// is carried into a room and presented, so it names its period, its scope and
// the person presenting it, and its comparison block reads as a finding rather
// than a calculation.

export interface PrintBlock {
  project: ProjectRecord;
  streams: {
    stream: ProjectStream;
    current: ProjectReport | null;
    previous: ProjectReport | null;
  }[];
}

// Blank cells read as "—" so an unreported month is visibly nothing rather than
// $0.00 — the same rule the screen follows, for the same reason.
function cell(n: number) {
  return n === 0 ? "—" : currency.format(n);
}

function units(n: number) {
  return n === 0 ? "—" : String(n);
}

// The amount, with the unit count beneath it — the stacked cell the screen
// table uses, for the same reason: a count trailing the figure puts every
// decimal point in a different place.
//
// A month with nothing in it reads "—". A total reads $0.00, because that is
// the report stating a figure rather than leaving a gap — but only where
// something was filed under the category at all. A category nobody has put a
// unit in is a gap all the way down, and "$0.00" there would be the document
// claiming the category traded nothing this year.
function Figure({
  totals,
  tracksUnits,
  isTotal,
}: {
  totals: StreamTotals;
  tracksUnits: boolean;
  isTotal?: boolean;
}) {
  return (
    <>
      {isTotal ? currency.format(totals.amount) : cell(totals.amount)}
      {tracksUnits ? (
        <span className="pt-sub">{units(totals.units)}</span>
      ) : null}
    </>
  );
}

// One cell of the year-on-year row.
//
// Figure() draws a zero as an em dash, because an unreported month is not a
// month that earned nothing. Here the reading flips: two years that both
// reported and landed on the same figure is a real answer — "no change" — and a
// dash would hide it. So the dash is kept only for a month neither year
// reported, and everything else carries its sign.
//
// The sign is in the text as well as the colour. This document is photocopied
// and read in black and white, where a rise and a fall distinguished by hue
// alone are the same mark.
function Change({
  current,
  previous,
  tracksUnits,
}: {
  current: StreamTotals;
  previous: StreamTotals;
  tracksUnits: boolean;
}) {
  const reported =
    current.amount !== 0 ||
    current.units !== 0 ||
    previous.amount !== 0 ||
    previous.units !== 0;
  if (!reported) return <>—</>;

  const amount = current.amount - previous.amount;
  const unitChange = current.units - previous.units;
  const sign = (value: number) => (value > 0 ? "+" : value < 0 ? "−" : "");
  const tone =
    amount === 0 ? undefined : amount > 0 ? "print-dash-up" : "print-dash-down";

  return (
    <>
      <span className={tone}>
        {`${sign(amount)}${currency.format(Math.abs(amount))}`}
      </span>
      {tracksUnits ? (
        <span className="pt-sub">
          {unitChange === 0
            ? "no change"
            : `${sign(unitChange)}${Math.abs(unitChange)} ${
                Math.abs(unitChange) === 1 ? "unit" : "units"
              }`}
        </span>
      ) : null}
    </>
  );
}

// Bands hold the table to about nine columns, which landscape carries at the
// document's normal type. The ladder is the guard for a project that outgrows
// that — a fifth category, say: past ten columns the type comes down with the
// count. A figure set small is readable, a figure cropped off the paper is not.
function densityFor(columns: number) {
  if (columns > 14) return "tight";
  if (columns > 10) return "dense";
  return "normal";
}

export function PrintableProjectReport({
  year,
  period,
  scopeLabel,
  blocks,
  presenter,
  selection = ALL_SELECTION,
}: {
  selection?: CategorySelection;
  year: number;
  // "2026", or "March 2026" with the month filter in play. The letterhead
  // states it, because a document handed round a room has to say which period
  // it is of — and a single-column table that only said "2026" would be read
  // as the year.
  period: string;
  scopeLabel: string;
  blocks: PrintBlock[];
  presenter: string;
}) {
  const printed = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="print-only" aria-hidden="true">
      <div className="print-doc print-doc-wide">
        <header className="print-letterhead">
          <OcicLogo width={150} height={64} priority className="print-logo" />
          <div className="print-title-block">
            <h1 className="print-title">Project performance report</h1>
            <p className="print-subtitle">
              Sales, leasing and property management · {period}
            </p>
          </div>
        </header>

        <dl className="print-meta">
          <div>
            <dt>Scope</dt>
            <dd>{scopeLabel}</dd>
          </div>
          <div>
            <dt>Presented by</dt>
            <dd>{presenter}</dd>
          </div>
          <div>
            <dt>Prepared</dt>
            <dd>{printed}</dd>
          </div>
        </dl>

        {blocks.map(({ project, streams }) =>
          streams.map(({ stream, current, previous }) => {
            const items = current?.items ?? [];
            const tracksUnits = streamTracksUnits(stream);
            const months = reportedMonths(items);
            const totals = yearTotals(items);
            const bands = groupIntoBands(items, selection);
            const showsTotal = showsGrandTotal(bands);
            const comparison = previous
              ? compareYears(items, previous.items)
              : null;
            const compareMonths = comparison?.months ?? [];
            const currentLine = lineTotals(items, compareMonths);
            const previousLine = lineTotals(previous?.items ?? [], compareMonths);
            const showsCompareTotal = compareMonths.length > 1;
            const comparisonColumns =
              1 + compareMonths.length + (showsCompareTotal ? 1 : 0);
            // The months run across the top now, so the table is as wide as the
            // year is long: the category name, a column per reported month, and
            // the year's own total where it earns a place.
            const showsYearColumn = months.length > 1;
            const columns = 1 + months.length + (showsYearColumn ? 1 : 0);
            const properties = hasNamedProperties(items)
              ? propertyGroups(items)
              : [];

            return (
              <section
                key={`${project.id}:${stream}`}
                className="print-department"
              >
                <h2 className="print-summary-title">
                  {project.label} · {projectStreamLabelFor(project.id, stream)}
                </h2>

                {items.length === 0 || months.length === 0 ? (
                  <p className="print-empty">
                    Nothing recorded for {period}.
                  </p>
                ) : (
                  <>
                    <table
                      className="print-table"
                      data-density={densityFor(columns)}
                    >
                      <thead>
                        <tr>
                          <th className="pt-item">Category</th>
                          {months.map((monthIndex) => (
                            <th key={monthIndex} className="pt-num">
                              {MONTH_NAMES[monthIndex]}
                            </th>
                          ))}
                          {showsYearColumn ? (
                            <th className="pt-num">Total</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {bands.map((band) => (
                          <Fragment key={band.label}>
                            {/* A band of one column named after itself — Land —
                                would head its own single row with the same
                                word. */}
                            {band.selfNamed ? null : (
                              <tr className="pt-section">
                                <td colSpan={columns}>{band.label}</td>
                              </tr>
                            )}
                            {band.columns.map((column) => (
                              <tr key={column.label}>
                                <td>{column.label}</td>
                                {months.map((monthIndex) => (
                                  <td key={monthIndex} className="pt-num">
                                    <Figure
                                      totals={monthTotals(
                                        column.items,
                                        monthIndex
                                      )}
                                      tracksUnits={tracksUnits}
                                    />
                                  </td>
                                ))}
                                {showsYearColumn ? (
                                  <td className="pt-num">
                                    <Figure
                                      totals={yearTotals(column.items)}
                                      tracksUnits={tracksUnits}
                                      isTotal={column.items.length > 0}
                                    />
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                            {band.showSubtotal ? (
                              <tr className="pt-subtotal">
                                <td>{band.label} total</td>
                                {months.map((monthIndex) => (
                                  <td key={monthIndex} className="pt-num">
                                    <Figure
                                      totals={monthTotals(
                                        bandItems(band),
                                        monthIndex
                                      )}
                                      tracksUnits={tracksUnits}
                                    />
                                  </td>
                                ))}
                                {showsYearColumn ? (
                                  <td className="pt-num">
                                    <Figure
                                      totals={yearTotals(bandItems(band))}
                                      tracksUnits={tracksUnits}
                                      isTotal={bandItems(band).length > 0}
                                    />
                                  </td>
                                ) : null}
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                      {showsTotal ? (
                        <tfoot>
                          <tr className="pt-total">
                            <td>Total</td>
                            {months.map((monthIndex) => (
                              <td key={monthIndex} className="pt-num">
                                <Figure
                                  totals={monthTotals(items, monthIndex)}
                                  tracksUnits={tracksUnits}
                                />
                              </td>
                            ))}
                            {showsYearColumn ? (
                              <td className="pt-num">
                                <Figure
                                  totals={totals}
                                  tracksUnits={tracksUnits}
                                  isTotal
                                />
                              </td>
                            ) : null}
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>

                    {/* The summary says how much land and how much built. This
                        says which building — the figures the category columns
                        are made of, read down the page instead of across it. */}
                    {properties.length > 0 ? (
                      <>
                        <p className="print-detail-title">By property</p>
                        <table
                          className="print-table"
                          data-density={densityFor(months.length + 2)}
                        >
                          <thead>
                            <tr>
                              <th className="pt-item">Property</th>
                              {months.map((monthIndex) => (
                                <th key={monthIndex} className="pt-num">
                                  {MONTH_NAMES[monthIndex]}
                                </th>
                              ))}
                              <th className="pt-num">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {properties.map((group) => (
                              <Fragment key={group.category}>
                                <tr className="pt-section">
                                  <td colSpan={months.length + 2}>
                                    {group.category}
                                  </td>
                                </tr>
                                {group.items.map((item) => (
                                  <tr key={item.id}>
                                    <td>{item.name}</td>
                                    {months.map((monthIndex) => (
                                      <td key={monthIndex} className="pt-num">
                                        <Figure
                                          totals={monthTotals(
                                            [item],
                                            monthIndex
                                          )}
                                          tracksUnits={tracksUnits}
                                        />
                                      </td>
                                    ))}
                                    <td className="pt-num">
                                      <Figure
                                        totals={yearTotals([item])}
                                        tracksUnits={tracksUnits}
                                        isTotal
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}

                    {/* The same month-by-month reading the screen gives, not
                        just the pair of totals underneath it.

                        The summary below answers "is the year ahead". This
                        answers "where" — a year can be $995,688 up on the
                        strength of one month and behind in five others, and the
                        printed document was the only place that could not be
                        asked. It is the table the office actually discusses, so
                        it is the one the PDF has to carry.

                        Same column count as the month table above, so it takes
                        the same density and finishes inside the same page. */}
                    {comparison && comparison.months.length > 0 && previous ? (
                      <>
                        {/* Says what the block is, in the words the screen uses
                            for it, and in the same treatment as "By property"
                            above — quieter than the stream heading, because it
                            introduces part of that section rather than a new
                            one.

                            Without it the grid opened on a header row reading
                            "Year | January | February", which is only a
                            comparison once you have read down to the second
                            row and worked out that 2025 is not a continuation
                            of 2026. A table should not need decoding before it
                            can be read.

                            Current year first, matching the screen and the
                            rows below: newest, then what it came from. */}
                        <p className="print-detail-title">
                          Comparison between {year} and {previous.period_year}
                        </p>
                        <table
                          className="print-table print-compare-grid"
                          data-density={densityFor(comparisonColumns)}
                        >
                          <thead>
                            <tr>
                              <th className="pt-item">Year</th>
                              {comparison.months.map((monthIndex) => (
                                <th key={monthIndex} className="pt-num">
                                  {MONTH_NAMES[monthIndex]}
                                </th>
                              ))}
                              {showsCompareTotal ? (
                                <th className="pt-num">Total</th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody>
                            {/* This year first, so the pair reads
                                newest-then-what-it-came-from — the same order as
                                the change row's sign, which is this year minus
                                last. */}
                            {[
                              { rowYear: year, totals: currentLine },
                              { rowYear: previous.period_year, totals: previousLine },
                            ].map(({ rowYear, totals }) => (
                              <tr key={rowYear}>
                                <td>{rowYear}</td>
                                {totals.cells.map((line, slot) => (
                                  <td
                                    key={comparison.months[slot]}
                                    className="pt-num"
                                  >
                                    <Figure
                                      totals={line}
                                      tracksUnits={tracksUnits}
                                    />
                                  </td>
                                ))}
                                {showsCompareTotal ? (
                                  <td className="pt-num">
                                    <Figure
                                      totals={totals.total}
                                      tracksUnits={tracksUnits}
                                      isTotal
                                    />
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                            <tr className="pt-subtotal">
                              <td>Change</td>
                              {currentLine.cells.map((line, slot) => (
                                <td key={comparison.months[slot]} className="pt-num">
                                  <Change
                                    current={line}
                                    previous={previousLine.cells[slot]}
                                    tracksUnits={tracksUnits}
                                  />
                                </td>
                              ))}
                              {showsCompareTotal ? (
                                <td className="pt-num">
                                  <Change
                                    current={currentLine.total}
                                    previous={previousLine.total}
                                    tracksUnits={tracksUnits}
                                  />
                                </td>
                              ) : null}
                            </tr>
                          </tbody>
                          </table>
                      </>
                    ) : null}

                    {comparison && comparison.months.length > 0 ? (
                      <table className="print-table print-compare">
                        <thead>
                          <tr>
                            <th className="pt-item">
                              {monthRangeLabel(comparison.months, "long")}
                            </th>
                            <th className="pt-num">{previous?.period_year}</th>
                            <th className="pt-num">{year}</th>
                            <th className="pt-num">Change</th>
                            <th className="pt-pct">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Value</td>
                            <td className="pt-num">
                              {currency.format(comparison.previous.amount)}
                            </td>
                            <td className="pt-num">
                              {currency.format(comparison.current.amount)}
                            </td>
                            <td className="pt-num">
                              {comparison.amountChange >= 0 ? "+" : "−"}
                              {currency.format(
                                Math.abs(comparison.amountChange)
                              )}
                            </td>
                            <td className="pt-pct">
                              {comparison.amountPercent === null
                                ? "—"
                                : `${comparison.amountPercent >= 0 ? "+" : "−"}${Math.abs(
                                    comparison.amountPercent
                                  ).toFixed(1)}%`}
                            </td>
                          </tr>
                          {tracksUnits ? (
                            <tr>
                              <td>Units</td>
                              <td className="pt-num">
                                {comparison.previous.units}
                              </td>
                              <td className="pt-num">
                                {comparison.current.units}
                              </td>
                              <td className="pt-num">
                                {comparison.unitChange >= 0 ? "+" : "−"}
                                {Math.abs(comparison.unitChange)}
                              </td>
                              <td className="pt-pct">
                                {comparison.unitPercent === null
                                  ? "—"
                                  : `${comparison.unitPercent >= 0 ? "+" : "−"}${Math.abs(
                                      comparison.unitPercent
                                    ).toFixed(1)}%`}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    ) : null}

                    {/* Why this block covers fewer months than the table above
                        it, said next to the block rather than in the page
                        footer.

                        The footer has carried the rule since this document was
                        written — "Comparisons cover only the months both years
                        have reported" — and it was not enough. A reader saw a
                        table running to August above a comparison headed
                        "January to June" and reported the export as broken,
                        which is a fair reading: an explanation at the bottom of
                        the page is not attached to the thing it explains.

                        Stated in full each time, because a PDF is read away
                        from the app and often a page at a time. The wording
                        follows the card on screen deliberately — the same
                        figure should not be qualified two different ways in two
                        places — but names the years outright, since the reader
                        of a printout has no filter bar to look at. */}
                    {comparison && comparison.months.length > 0 && previous ? (
                      <p className="print-compare-note">
                        {comparison.months.length < months.length ? (
                          <>
                            Compares{" "}
                            {monthRangeLabel(comparison.months, "long")} —{" "}
                            {comparison.months.length === 1
                              ? "the only month"
                              : `the ${comparison.months.length} months`}{" "}
                            both {previous.period_year} and {year} have
                            reported. The table above covers{" "}
                            {monthRangeLabel(months, "long")}, so its totals run
                            ahead of the figures here.
                          </>
                        ) : (
                          <>
                            Compares{" "}
                            {monthRangeLabel(comparison.months, "long")} —{" "}
                            {comparison.months.length === 1
                              ? "the only month"
                              : "every month"}{" "}
                            both {previous.period_year} and {year} have
                            reported.
                          </>
                        )}
                      </p>
                    ) : null}
                  </>
                )}
              </section>
            );
          })
        )}

        <footer className="print-footer">
          OCIC · Project performance {period} · prepared {printed}. Comparisons
          cover only the months both years have reported.
        </footer>
      </div>
    </div>
  );
}
