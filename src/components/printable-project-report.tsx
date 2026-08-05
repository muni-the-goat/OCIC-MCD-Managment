import { OcicLogo } from "@/components/ocic-logo";
import { Fragment } from "react";
import {
  bandColumnCount,
  bandItems,
  compareYears,
  currency,
  groupIntoBands,
  hasNamedProperties,
  monthTotals,
  propertyGroups,
  reportedMonths,
  yearTotals,
  type ProjectRecord,
  type StreamTotals,
} from "@/lib/project-reports";
import {
  MONTH_NAMES,
  projectStreamLabel,
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
  scopeLabel,
  blocks,
  presenter,
}: {
  year: number;
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
              Sales, leasing and property management · {year}
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
            const bands = groupIntoBands(items);
            const comparison = previous
              ? compareYears(items, previous.items)
              : null;
            // Month, every band's columns, Total.
            const columns =
              2 + bands.reduce((n, band) => n + bandColumnCount(band), 0);
            const properties = hasNamedProperties(items)
              ? propertyGroups(items)
              : [];

            return (
              <section
                key={`${project.id}:${stream}`}
                className="print-department"
              >
                <h2 className="print-summary-title">
                  {project.label} · {projectStreamLabel(stream)}
                </h2>

                {items.length === 0 || months.length === 0 ? (
                  <p className="print-empty">
                    Nothing recorded for {year}.
                  </p>
                ) : (
                  <>
                    <table
                      className="print-table"
                      data-density={densityFor(columns)}
                    >
                      <thead>
                        {/* The same two tiers the dashboard shows: Land and
                            Built properties across the top, the categories
                            inside each beneath. */}
                        <tr>
                          <th className="pt-item" rowSpan={2}>
                            Month
                          </th>
                          {bands.map((band) => (
                            <th
                              key={band.label}
                              className="pt-group"
                              colSpan={bandColumnCount(band)}
                            >
                              {band.label}
                            </th>
                          ))}
                          <th className="pt-num" rowSpan={2}>
                            Total
                          </th>
                        </tr>
                        <tr>
                          {bands.map((band) =>
                            band.selfNamed ? (
                              <th key={band.label} className="pt-sub-head" />
                            ) : (
                              <Fragment key={band.label}>
                                {band.columns.map((column) => (
                                  <th
                                    key={column.label}
                                    className="pt-sub-head"
                                  >
                                    {column.label}
                                  </th>
                                ))}
                                {band.showSubtotal ? (
                                  <th className="pt-sub-head">Subtotal</th>
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
                            <tr key={monthIndex}>
                              <td>{MONTH_NAMES[monthIndex]}</td>
                              {bands.map((band) => (
                                <Fragment key={band.label}>
                                  {band.columns.map((column) => (
                                    <td key={column.label} className="pt-num">
                                      <Figure
                                        totals={monthTotals(
                                          column.items,
                                          monthIndex
                                        )}
                                        tracksUnits={tracksUnits}
                                      />
                                    </td>
                                  ))}
                                  {band.showSubtotal ? (
                                    <td className="pt-num pt-subtotal">
                                      <Figure
                                        totals={monthTotals(
                                          bandItems(band),
                                          monthIndex
                                        )}
                                        tracksUnits={tracksUnits}
                                      />
                                    </td>
                                  ) : null}
                                </Fragment>
                              ))}
                              <td className="pt-num">
                                <Figure
                                  totals={row}
                                  tracksUnits={tracksUnits}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="pt-total">
                          <td>Total</td>
                          {bands.map((band) => (
                            <Fragment key={band.label}>
                              {band.columns.map((column) => (
                                <td key={column.label} className="pt-num">
                                  <Figure
                                    totals={yearTotals(column.items)}
                                    tracksUnits={tracksUnits}
                                    isTotal={column.items.length > 0}
                                  />
                                </td>
                              ))}
                              {band.showSubtotal ? (
                                <td className="pt-num pt-subtotal">
                                  <Figure
                                    totals={yearTotals(bandItems(band))}
                                    tracksUnits={tracksUnits}
                                    isTotal={bandItems(band).length > 0}
                                  />
                                </td>
                              ) : null}
                            </Fragment>
                          ))}
                          <td className="pt-num">
                            <Figure
                              totals={totals}
                              tracksUnits={tracksUnits}
                              isTotal
                            />
                          </td>
                        </tr>
                      </tfoot>
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

                    {comparison && comparison.months.length > 0 ? (
                      <table className="print-table print-compare">
                        <thead>
                          <tr>
                            <th className="pt-item">
                              {MONTH_NAMES[comparison.months[0]]} to{" "}
                              {
                                MONTH_NAMES[
                                  comparison.months[
                                    comparison.months.length - 1
                                  ]
                                ]
                              }
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
                  </>
                )}
              </section>
            );
          })
        )}

        <footer className="print-footer">
          OCIC · Project performance {year} · prepared {printed}. Comparisons
          cover only the months both years have reported.
        </footer>
      </div>
    </div>
  );
}
