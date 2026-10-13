import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Handshake,
  KeyRound,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { PrintPortal } from "@/components/print-portal";
import { PrintableProjectsDashboard } from "@/components/printable-projects-dashboard";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectStatCard } from "@/components/project-stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PILL_ACTIONS, SURFACE } from "@/lib/control-styles";
import {
  YearCompareChart,
  type YearCompareRow,
} from "@/components/year-compare-chart";
import { getProfile, seesProjectReports } from "@/lib/auth";
import {
  ALL_PROJECTS,
  ALL_STREAMS,
  categoryOptions,
  categorySelectionLabel,
  categorySelectionValue,
  compareYears,
  type Comparison,
  currency,
  filterItems,
  monthRangeLabel,
  monthSelectionValue,
  monthTotals,
  parseCategorySelection,
  parseMonthSelection,
  projectPeriodLabel,
  propertyComparison,
  reportedMonths,
  restrictToMonth,
  yearTotals,
} from "@/lib/project-reports";
import {
  getProjects,
  getProjectYears,
  getStreamReports,
  streamKey,
} from "@/lib/project-reports-server";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  PROJECT_STREAMS,
  projectStreamLabel,
  projectStreamLabelFor,
  streamTracksUnits,
  type ProjectReport,
  type ProjectStream,
} from "@/lib/types";

// One per report, so the three cards are told apart before the words are read.
const STREAM_ICONS: Record<ProjectStream, LucideIcon> = {
  sales: Handshake,
  leasing: KeyRound,
  property_management: Building2,
};

// A label over a figure or a chart inside a card. Sentence case at caption
// size, where it was uppercase tracked-out Montserrat: the marketing pages
// dropped the all-caps eyebrows, and a card full of them read as shouting.
const SUBHEAD = "type-caption font-semibold text-muted-foreground";

export const metadata = { title: "Dashboard" };

// The Vice President's dashboard. The Projects page is the record — every
// figure, in the shape the workbook has always had. This is the reading of it:
// this year against last, drawn rather than tabulated, because "are we ahead of
// last year" is a question about two shapes and the table answers it in
// thirty-four numbers.
//
// It carries the same filters as the Projects page, and for the same reason
// they are on that page: the answer is only as good as the reader's grip on
// what is in it.

// Every comparison here covers the months *both* years have reported. A
// half-done 2026 set against a complete 2025 shows a collapse that is really
// just the calendar — and that is exactly the kind of figure someone repeats in
// a meeting before anyone checks it.
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
        "type-callout inline-flex items-center gap-1 font-medium tabular-nums",
        flat
          ? "text-muted-foreground"
          : up
            ? "text-status-good"
            : "text-status-critical"
      )}
    >
      {/* The direction is carried by the word and the arrow as well as the
          colour: a rise and a fall must not be distinguishable by hue alone. */}
      <Icon className="size-4" aria-hidden />
      <span>
        {flat ? "No change" : `${up ? "Up" : "Down"} ${suffix}`}
        {percent === null ? "" : ` · ${Math.abs(percent).toFixed(1)}%`}
      </span>
    </span>
  );
}

export default async function ProjectsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    project?: string;
    stream?: string;
    category?: string;
  }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  if (!seesProjectReports(profile.role)) redirect("/dashboard");

  const [years, projects] = await Promise.all([
    getProjectYears(),
    getProjects(),
  ]);

  const requestedYear = Number(params.year);
  const year = years.includes(requestedYear) ? requestedYear : years[0];
  const month = parseMonthSelection(params.month);
  const period = projectPeriodLabel(month, year);

  const projectParam =
    params.project && projects.some((p) => p.id === params.project)
      ? params.project
      : ALL_PROJECTS;
  // ?category= carried the report stream before the word was needed for the
  // Land/Built filter; a link shared under the old name still opens.
  const streamValue = PROJECT_STREAMS.includes(params.stream as ProjectStream)
    ? params.stream
    : PROJECT_STREAMS.includes(params.category as ProjectStream)
      ? params.category
      : undefined;
  const streamParam: ProjectStream | typeof ALL_STREAMS = streamValue
    ? (streamValue as ProjectStream)
    : ALL_STREAMS;

  const shownProjects =
    projectParam === ALL_PROJECTS
      ? projects
      : projects.filter((p) => p.id === projectParam);
  const shownStreams =
    streamParam === ALL_STREAMS
      ? PROJECT_STREAMS
      : PROJECT_STREAMS.filter((s) => s === streamParam);

  const reports = await getStreamReports(
    shownProjects.map((project) => project.id),
    shownStreams,
    year
  );
  const loaded = shownProjects.map((project) => ({
    project,
    streams: shownStreams.map((stream) => ({
      stream,
      current: reports.get(streamKey(project.id, stream))?.current ?? null,
      previous: reports.get(streamKey(project.id, stream))?.previous ?? null,
    })),
  }));

  const options = categoryOptions(
    loaded.flatMap(({ streams }) =>
      streams.flatMap((entry) => entry.current?.items ?? [])
    )
  );
  const selection = parseCategorySelection(params.category, options);
  // Category first, then month, and both years the same way — a comparison
  // narrowed on one side only would set March against the whole of last year.
  const narrow = (report: ProjectReport | null) =>
    report
      ? {
          ...report,
          items: restrictToMonth(
            filterItems(report.items, selection),
            month
          ),
        }
      : null;

  const blocks = loaded.map(({ project, streams }) => ({
    project,
    streams: streams
      .map((entry) => {
        const current = narrow(entry.current);
        const previous = narrow(entry.previous);
        const items = current?.items ?? [];
        const previousItems = previous?.items ?? [];

        // Both years' months, so a month only last year reported still gets
        // its place on the axis rather than silently leaving it.
        const currentMonths = new Set(reportedMonths(items));
        const previousMonths = new Set(reportedMonths(previousItems));
        const months = [
          ...new Set([...currentMonths, ...previousMonths]),
        ].sort((a, b) => a - b);

        return {
          stream: entry.stream,
          previousYear: previous?.period_year ?? null,
          // The axis below is the union of both years, so a month only last
          // year reported keeps its place on the chart. Whether the *card*
          // appears at all is a different question, and this is it.
          reported: currentMonths.size > 0,
          comparison: previous ? compareYears(items, previous.items) : null,
          // What this year alone reported, for the figures block on a card
          // whose month chart has stood down and which has no earlier year to
          // set itself against.
          totals: yearTotals(items),
          // One bar pair per building, so the properties can be read against
          // each other and against their own last year at the same time.
          properties: propertyComparison(items, previousItems).map(
            (row): YearCompareRow => ({
              key: row.key,
              label: row.label,
              full: row.label,
              current: row.current,
              previous: row.previous,
            })
          ),
          // A month the year never reported is null, not zero. On the line
          // chart that is the difference between a gap and a plunge to the
          // axis, and the plunge would read as a month that earned nothing.
          rows: months.map(
            (monthIndex): YearCompareRow => ({
              key: String(monthIndex),
              label: MONTH_SHORT[monthIndex],
              full: `${MONTH_NAMES[monthIndex]} ${year}`,
              current: currentMonths.has(monthIndex)
                ? monthTotals(items, monthIndex).amount
                : null,
              previous: previousMonths.has(monthIndex)
                ? monthTotals(previousItems, monthIndex).amount
                : null,
            })
          ),
        };
      })
      // A stream with nothing in it this period stands down rather than
      // heading a card whose figure is $0.00 — which is a claim that it
      // traded nothing, not that nobody has filed it yet. Pick a month sales
      // has not reached and that is exactly the difference. Where every
      // stream stands down, the page's own empty state says so by name.
      .filter((entry) => entry.reported),
  }));

  const shownBlocks = blocks.filter((block) => block.streams.length > 0);

  // The portfolio bar: one pair per report, on the shared months. It earns its
  // place only where there is more than one report to line up — with a single
  // one it would restate the card directly beneath it.
  const portfolio: YearCompareRow[] = PROJECT_STREAMS.map((stream) => {
    const entries = shownBlocks
      .flatMap((block) => block.streams)
      .filter((entry) => entry.stream === stream);
    const label = projectStreamLabel(stream);
    return {
      key: stream,
      // "Property management" is wider than the bar it labels; the card's own
      // heading and the tooltip both give it in full.
      label: stream === "property_management" ? "Property" : label,
      full: label,
      current: entries.reduce(
        (sum, entry) => sum + (entry.comparison?.current.amount ?? 0),
        0
      ),
      previous: entries.reduce(
        (sum, entry) => sum + (entry.comparison?.previous.amount ?? 0),
        0
      ),
    };
  }).filter((row) => row.current !== 0 || row.previous !== 0);

  const previousYear =
    shownBlocks
      .flatMap((block) => block.streams)
      .find((entry) => entry.previousYear !== null)?.previousYear ?? null;
  // Last year read at the same resolution: with March selected, this year's
  // March is tracking against last year's March, not against last year.
  const previousPeriod =
    previousYear === null ? null : projectPeriodLabel(month, previousYear);

  // Worded exactly as the Projects page words it, so the two PDFs cannot
  // describe the same selection differently.
  const scopeLabel = [
    projectParam === ALL_PROJECTS
      ? "All projects"
      : (projects.find((p) => p.id === projectParam)?.label ?? "All projects"),
    streamParam === ALL_STREAMS
      ? "All reports"
      : projectStreamLabel(streamParam),
    categorySelectionLabel(selection),
  ].join(" · ");

  const firstName = (profile.full_name || profile.email).split(" ")[0];

  // One card per report, added across whichever projects are on screen. On the
  // shared months, like every other comparison here.
  const headline = PROJECT_STREAMS.map((stream) => {
    const entries = shownBlocks
      .flatMap((block) => block.streams)
      .filter((entry) => entry.stream === stream && entry.comparison);
    const sum = (pick: (c: Comparison) => number) =>
      entries.reduce((total, entry) => total + pick(entry.comparison!), 0);

    const value = sum((c) => c.current.amount);
    const previous = sum((c) => c.previous.amount);
    return {
      stream,
      value,
      previous,
      change: value - previous,
      // Recomputed from the summed figures rather than averaged out of the
      // per-project ones, which would weight a small project like a large one.
      percent: previous === 0 ? null : ((value - previous) / previous) * 100,
      units: sum((c) => c.current.units),
      previousUnits: sum((c) => c.previous.units),
      months: entries[0]?.comparison?.months ?? [],
    };
  }).filter((row) => row.value !== 0 || row.previous !== 0);

  return (
    // One centred column, the width of the marketing dashboard's, so the two
    // dashboards read as one design whichever side of the office opens them.
    <div className="mx-auto w-full max-w-6xl space-y-10 sm:space-y-12">
      {/* A large title with the greeting above it and one sentence below
          saying what the page compares. It replaces a welcome card whose
          chips restated the date, the role from the top bar and the project
          count the filter row already shows. */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <p className="type-eyebrow truncate">Bonjour, {firstName}</p>
          <h1 className="type-title">Dashboard</h1>
          <p className="type-subtitle">
            {previousPeriod === null
              ? `Here is how ${period} is going.`
              : `Here is how ${period} is tracking against ${previousPeriod}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="ghost"
            className="h-11 gap-1.5 rounded-full px-4 text-[0.9375rem] font-semibold text-primary hover:text-primary"
          >
            <Link href="/projects">
              Full tables
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          {/* "New report" is what the MCD dashboard's button says, and it
              files a different kind of report entirely. Two buttons with one
              name, each meaning whichever side of the office you happened to
              be standing on. */}
          <Button
            asChild
            className="h-11 gap-2 rounded-full px-5 text-[0.9375rem] font-semibold"
          >
            <Link href="/projects/new">
              <Plus className="size-[1.125rem]" />
              New project report
            </Link>
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        {/* Export sits with the filters rather than up in the header: what it
            produces is whatever the filters currently select, so the control
            belongs beside the thing that decides its contents. Same
            arrangement as the Projects page. */}
        <div className="flex flex-wrap items-center gap-2">
          <ProjectFilters
            years={years}
            selectedYear={year}
            selectedMonth={monthSelectionValue(month)}
            projects={projects}
            selectedProject={projectParam}
            selectedStream={streamParam}
            options={options}
            selectedCategory={categorySelectionValue(selection)}
          />
          <div className={PILL_ACTIONS}>
            <ExportPdfButton label="Export PDF" />
          </div>
        </div>

        {headline.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {headline.map((row) => (
              <ProjectStatCard
                key={row.stream}
                label={projectStreamLabel(row.stream)}
                icon={STREAM_ICONS[row.stream]}
                caption={
                  row.months.length === 0
                    ? previousPeriod === null
                      ? `${period}, with no earlier year to set it against`
                      : `${period}, with nothing in ${previousPeriod} to set it against`
                    : `${monthRangeLabel(row.months)} ${year}, against ${previousYear}`
                }
                value={row.value}
                previous={row.previous}
                change={row.change}
                percent={row.percent}
                units={
                  streamTracksUnits(row.stream) ? row.units : undefined
                }
                previousUnits={
                  streamTracksUnits(row.stream) ? row.previousUnits : undefined
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {shownBlocks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-card px-6 py-14 text-center">
          <p className="type-headline">Nothing recorded for this selection.</p>
          <p className="type-callout text-muted-foreground">
            No report has figures for {period}. Try another month or year.
          </p>
        </div>
      ) : (
        <>
          {portfolio.length > 1 ? (
            <Card className={SURFACE}>
              <CardHeader>
                <CardTitle className="type-headline">
                  Where the year stands
                </CardTitle>
                <CardDescription className="type-callout">
                  Each report against {previousYear ?? "last year"}, counting
                  only the months both years have reported.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <YearCompareChart
                  rows={portfolio}
                  currentYear={year}
                  previousYear={previousYear}
                  minWidth={360}
                  height="h-56"
                />
              </CardContent>
            </Card>
          ) : null}

          {shownBlocks.map(({ project, streams }) => (
            <section key={project.id} className="space-y-4">
              {shownProjects.length > 1 ? (
                <h2 className="type-section">{project.label}</h2>
              ) : null}
              {streams.map((entry) => {
                const tracksUnits = streamTracksUnits(entry.stream);
                const comparison = entry.comparison;
                const range =
                  comparison && comparison.months.length > 0
                    ? monthRangeLabel(comparison.months)
                    : null;
                // A "by month" chart of a single month is not a chart: one dot
                // per year, saying what the figures beside it already say in
                // words. It stands down, and the figures take its place — which
                // is the whole of the card once the month filter has narrowed
                // the year to March.
                const showsMonthChart = entry.rows.length > 1;
                const compared =
                  comparison && comparison.months.length > 0
                    ? comparison
                    : null;

                return (
                  <Card key={entry.stream} className={SURFACE}>
                    <CardHeader>
                      <CardTitle className="type-headline">
                        {projectStreamLabelFor(project.id, entry.stream)}
                      </CardTitle>
                      <CardDescription className="type-callout">
                        {range === null
                          ? entry.previousYear === null
                            ? `${period}, with no earlier year to set it against.`
                            : `${period}, with nothing in ${projectPeriodLabel(
                                month,
                                entry.previousYear
                              )} to set it against.`
                          : `${range}, ${year} against ${entry.previousYear}.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* The cards at the top already carry these figures,
                          and with one project on screen they are the same
                          figures. They earn their place where there is more
                          than one project for the roll-up to have rolled up —
                          or where the month chart has stood down and they are
                          the only thing left on the card to read. */}
                      {shownProjects.length > 1 || !showsMonthChart ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className={SUBHEAD}>
                              Value
                            </p>
                            <p className="font-heading text-2xl font-bold tracking-[-0.016em] tabular-nums">
                              {/* The compared figure where there is a year to
                                  compare against — the shared months, like
                                  everything else here — and this year's own
                                  total where there is not. */}
                              {currency.format(
                                compared
                                  ? compared.current.amount
                                  : entry.totals.amount
                              )}
                              {compared ? (
                                <span className="type-callout ml-2 font-normal tracking-normal text-muted-foreground">
                                  from{" "}
                                  {currency.format(compared.previous.amount)}
                                </span>
                              ) : null}
                            </p>
                            {compared ? (
                              <Delta
                                change={compared.amountChange}
                                percent={compared.amountPercent}
                                suffix={currency.format(
                                  Math.abs(compared.amountChange)
                                )}
                              />
                            ) : null}
                          </div>
                          {tracksUnits ? (
                            <div className="space-y-1">
                              <p className={SUBHEAD}>
                                Units
                              </p>
                              <p className="font-heading text-2xl font-bold tracking-[-0.016em] tabular-nums">
                                {compared
                                  ? compared.current.units
                                  : entry.totals.units}
                                {compared ? (
                                  <span className="type-callout ml-2 font-normal tracking-normal text-muted-foreground">
                                    from {compared.previous.units}
                                  </span>
                                ) : null}
                              </p>
                              {compared ? (
                                <Delta
                                  change={compared.unitChange}
                                  percent={compared.unitPercent}
                                  suffix={`${Math.abs(compared.unitChange)}`}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {showsMonthChart ? (
                        <div className="space-y-2">
                          <p className={SUBHEAD}>
                            By month
                          </p>
                          <YearCompareChart
                            rows={entry.rows}
                            currentYear={year}
                            previousYear={entry.previousYear}
                            variant="line"
                          />
                        </div>
                      ) : null}

                      {/* The month chart says when the money came in; this says
                          which building it came from, and how each one did
                          against itself last year. Ranked, so the order is
                          part of the answer. */}
                      {entry.properties.length > 1 ? (
                        <div className="space-y-2">
                          <p className={SUBHEAD}>
                            By property
                          </p>
                          <YearCompareChart
                            rows={entry.properties}
                            currentYear={year}
                            previousYear={entry.previousYear}
                            minWidth={Math.max(
                              360,
                              entry.properties.length * 110
                            )}
                          />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          ))}
        </>
      )}

      {/* Hidden on screen, revealed by the print stylesheet. It prints what the
          filters select, so the PDF and the page cannot disagree about what the
          reader was looking at when they pressed Export.

          It renders its own charts at fixed pixel sizes rather than reusing the
          ones above: those measure their container, and this region is
          display:none until the print dialog opens. */}
      <PrintPortal>
        <PrintableProjectsDashboard
          year={year}
          previousYear={previousYear}
          period={period}
          previousPeriod={previousPeriod}
          scopeLabel={scopeLabel}
          presenter={profile.full_name || profile.email}
          headline={headline}
          portfolio={portfolio}
          blocks={shownBlocks.map(({ project, streams }) => ({
            project,
            streams: streams.map((entry) => ({
              stream: entry.stream,
              previousYear: entry.previousYear,
              rows: entry.rows,
              properties: entry.properties,
            })),
          }))}
        />
      </PrintPortal>
    </div>
  );
}
