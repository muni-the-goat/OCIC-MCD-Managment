import { OcicLogo } from "@/components/ocic-logo";
import {
  PrintChartLegend,
  PrintYearCompareChart,
  type YearCompareRow,
} from "@/components/year-compare-chart";
import {
  currency,
  monthRangeLabel,
  type ProjectRecord,
} from "@/lib/project-reports";
import {
  projectStreamLabel,
  streamTracksUnits,
  type ProjectStream,
} from "@/lib/types";

// The projects dashboard, as a document.
//
// PrintableProjectReport is the record — every figure the workbook holds, in
// the shape it has always had. This is the reading of it, and the distinction
// is the same one the two screens make: that one is carried into a room to be
// checked against, this one to be presented from. It is charts and headline
// figures, and it deliberately does not restate the tables.
//
// Same letterhead, same landscape page, same `print-only` machinery as the
// other two documents, so the three come out of the same house.

export interface PrintDashHeadline {
  stream: ProjectStream;
  value: number;
  previous: number;
  change: number;
  percent: number | null;
  units: number;
  previousUnits: number;
  months: number[];
}

export interface PrintDashStream {
  stream: ProjectStream;
  previousYear: number | null;
  rows: YearCompareRow[];
  properties: YearCompareRow[];
}

export interface PrintDashBlock {
  project: ProjectRecord;
  streams: PrintDashStream[];
}

// Up and down are named as well as coloured. A PDF gets photocopied, and a
// black-and-white copy of a red number is just a number.
function Delta({
  change,
  percent,
  suffix,
}: {
  change: number;
  percent: number | null;
  suffix: string;
}) {
  if (change === 0) return <span className="print-dash-flat">No change</span>;
  const up = change > 0;
  return (
    <span className={up ? "print-dash-up" : "print-dash-down"}>
      {up ? "Up" : "Down"} {suffix}
      {percent === null ? "" : ` · ${Math.abs(percent).toFixed(1)}%`}
    </span>
  );
}

export function PrintableProjectsDashboard({
  year,
  previousYear,
  period,
  previousPeriod,
  scopeLabel,
  presenter,
  headline,
  portfolio,
  blocks,
}: {
  year: number;
  previousYear: number | null;
  // "2026" and "2025", or "March 2026" and "March 2025" once the month filter
  // has been used. The subtitle names both, because a document that said only
  // "2026" while its figures covered March would be the kind of mislabelling
  // the workbook's own "Jan-May" heading was.
  period: string;
  previousPeriod: string | null;
  scopeLabel: string;
  presenter: string;
  headline: PrintDashHeadline[];
  portfolio: YearCompareRow[];
  blocks: PrintDashBlock[];
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
            <h1 className="print-title">Projects dashboard</h1>
            <p className="print-subtitle">
              {previousPeriod === null
                ? `How ${period} is going`
                : `How ${period} is tracking against ${previousPeriod}`}
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

        {headline.length > 0 ? (
          <section className="print-dash-cards">
            {headline.map((row) => (
              <div key={row.stream} className="print-dash-card">
                <p className="print-dash-label">
                  {projectStreamLabel(row.stream)}
                </p>
                <p className="print-dash-value">{currency.format(row.value)}</p>
                <p className="print-dash-meta">
                  from {currency.format(row.previous)}
                </p>
                <p className="print-dash-delta">
                  <Delta
                    change={row.change}
                    percent={row.percent}
                    suffix={currency.format(Math.abs(row.change))}
                  />
                </p>
                {streamTracksUnits(row.stream) ? (
                  <p className="print-dash-meta">
                    {row.units} units, from {row.previousUnits}
                  </p>
                ) : null}
                {/* The range every figure above covers, stated rather than
                    assumed — the same guard the other two documents carry. */}
                <p className="print-dash-range">
                  {row.months.length === 0
                    ? previousPeriod === null
                      ? `${period}, with no earlier year to set it against`
                      : `${period}, with nothing in ${previousPeriod} to set it against`
                    : `${monthRangeLabel(row.months)} ${year}, against ${previousYear}`}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {portfolio.length > 1 ? (
          <section className="print-dash-block">
            <h2 className="print-summary-title">Where the year stands</h2>
            <PrintChartLegend currentYear={year} previousYear={previousYear} />
            <PrintYearCompareChart rows={portfolio} height={210} />
          </section>
        ) : null}

        {blocks.map(({ project, streams }) =>
          streams.map((entry) => (
            <section
              key={`${project.id}:${entry.stream}`}
              className="print-dash-block"
            >
              <h2 className="print-summary-title">
                {project.label} · {projectStreamLabel(entry.stream)}
              </h2>
              <PrintChartLegend
                currentYear={year}
                previousYear={entry.previousYear}
              />
              {/* A month chart of a single month is one dot per year, saying
                  what the cards above already say in words. It stands down,
                  the same way it does on screen. */}
              {entry.rows.length > 1 ? (
                <>
                  <p className="print-detail-title">By month</p>
                  <PrintYearCompareChart rows={entry.rows} variant="line" />
                </>
              ) : null}
              {entry.properties.length > 1 ? (
                <>
                  <p className="print-detail-title">By property</p>
                  <PrintYearCompareChart
                    rows={entry.properties}
                    height={210}
                  />
                </>
              ) : null}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
