import { OcicLogo } from "@/components/ocic-logo";
import {
  compareYears,
  currency,
  monthTotals,
  reportedMonths,
  yearTotals,
  type ProjectRecord,
} from "@/lib/project-reports";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  UNIT_KEYS,
  itemTotal,
  itemUnitTotal,
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
      <div className="print-doc">
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
            const comparison = previous
              ? compareYears(items, previous.items)
              : null;

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
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th className="pt-item">Month</th>
                          {items.map((item) => (
                            <th key={item.id} className="pt-num">
                              {item.name}
                            </th>
                          ))}
                          <th className="pt-num">Total</th>
                          {tracksUnits ? (
                            <th className="pt-num">Units</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((monthIndex) => {
                          const row = monthTotals(items, monthIndex);
                          return (
                            <tr key={monthIndex}>
                              <td>{MONTH_NAMES[monthIndex]}</td>
                              {items.map((item) => (
                                <td key={item.id} className="pt-num">
                                  {cell(
                                    Number(item[MONTH_KEYS[monthIndex]] ?? 0)
                                  )}
                                  {tracksUnits ? (
                                    <span className="pt-sub">
                                      {units(
                                        Number(
                                          item[UNIT_KEYS[monthIndex]] ?? 0
                                        )
                                      )}
                                    </span>
                                  ) : null}
                                </td>
                              ))}
                              <td className="pt-num">{cell(row.amount)}</td>
                              {tracksUnits ? (
                                <td className="pt-num">{row.units}</td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="pt-total">
                          <td>Total</td>
                          {items.map((item) => (
                            <td key={item.id} className="pt-num">
                              {currency.format(itemTotal(item))}
                              {tracksUnits ? (
                                <span className="pt-sub">
                                  {units(itemUnitTotal(item))}
                                </span>
                              ) : null}
                            </td>
                          ))}
                          <td className="pt-num">
                            {currency.format(totals.amount)}
                          </td>
                          {tracksUnits ? (
                            <td className="pt-num">{totals.units}</td>
                          ) : null}
                        </tr>
                      </tfoot>
                    </table>

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
