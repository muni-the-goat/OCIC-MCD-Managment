import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChartColumnBig,
  Handshake,
  KeyRound,
  Minus,
  Plus,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
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
import {
  YearCompareChart,
  type YearCompareRow,
} from "@/components/year-compare-chart";
import { getProfile, seesProjectReports } from "@/lib/auth";
import {
  ALL_PROJECTS,
  ALL_STREAMS,
  categoryOptions,
  categorySelectionValue,
  compareYears,
  type Comparison,
  currency,
  filterItems,
  monthTotals,
  parseCategorySelection,
  propertyComparison,
  reportedMonths,
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
  roleLabel,
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

function Chip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </span>
  );
}

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
        "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
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
  const narrow = (report: ProjectReport | null) =>
    report ? { ...report, items: filterItems(report.items, selection) } : null;

  const blocks = loaded.map(({ project, streams }) => ({
    project,
    streams: streams
      .map((entry) => {
        const current = narrow(entry.current);
        const previous = narrow(entry.previous);
        const items = current?.items ?? [];
        const previousItems = previous?.items ?? [];

        // Both years' months, so a month only last year reported still gets its
        // bar rather than silently leaving the axis.
        const months = [
          ...new Set([
            ...reportedMonths(items),
            ...reportedMonths(previousItems),
          ]),
        ].sort((a, b) => a - b);

        return {
          stream: entry.stream,
          previousYear: previous?.period_year ?? null,
          comparison: previous ? compareYears(items, previous.items) : null,
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
          rows: months.map(
            (monthIndex): YearCompareRow => ({
              key: String(monthIndex),
              label: MONTH_SHORT[monthIndex],
              full: `${MONTH_NAMES[monthIndex]} ${year}`,
              current: monthTotals(items, monthIndex).amount,
              previous: monthTotals(previousItems, monthIndex).amount,
            })
          ),
        };
      })
      .filter((entry) => entry.rows.length > 0),
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

  const firstName = (profile.full_name || profile.email).split(" ")[0];
  const now = new Date();

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
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ChartColumnBig className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Projects workspace
              </p>
              <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
                Bonjour, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {previousYear === null
                  ? `Here is how ${year} is going.`
                  : `Here is how ${year} is tracking against ${previousYear}.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip icon={CalendarDays}>
              {now.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </Chip>
            <Chip icon={ShieldCheck}>{roleLabel(profile.role)}</Chip>
            <Chip icon={Building2}>
              {shownProjects.length}{" "}
              {shownProjects.length === 1 ? "project" : "projects"}
            </Chip>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
            >
              <Link href="/projects">
                Full tables
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {/* "New report" is what the MCD dashboard's button says, and it
                files a different kind of report entirely. Two buttons with one
                name, each meaning whichever side of the office you happened to
                be standing on. */}
            <Button asChild size="sm" className="gap-1.5 rounded-full">
              <Link href="/projects/new">
                <Plus className="size-4" />
                New project report
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <ProjectFilters
        years={years}
        selectedYear={year}
        projects={projects}
        selectedProject={projectParam}
        selectedStream={streamParam}
        options={options}
        selectedCategory={categorySelectionValue(selection)}
      />

      {headline.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {headline.map((row) => (
            <ProjectStatCard
              key={row.stream}
              label={projectStreamLabel(row.stream)}
              icon={STREAM_ICONS[row.stream]}
              caption={
                row.months.length === 0
                  ? `${year}, with no earlier year to set it against`
                  : `${MONTH_SHORT[row.months[0]]}–${MONTH_SHORT[row.months[row.months.length - 1]]} ${year}, against ${previousYear}`
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

      {shownBlocks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing recorded for this selection in {year}.
        </p>
      ) : (
        <>
          {portfolio.length > 1 ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Where the year stands</CardTitle>
                <CardDescription>
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
            <section key={project.id} className="space-y-5">
              {shownProjects.length > 1 ? (
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  {project.label}
                </h2>
              ) : null}
              {streams.map((entry) => {
                const tracksUnits = streamTracksUnits(entry.stream);
                const comparison = entry.comparison;
                const range =
                  comparison && comparison.months.length > 0
                    ? `${MONTH_SHORT[comparison.months[0]]}–${
                        MONTH_SHORT[
                          comparison.months[comparison.months.length - 1]
                        ]
                      }`
                    : null;

                return (
                  <Card key={entry.stream} className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>{projectStreamLabel(entry.stream)}</CardTitle>
                      <CardDescription>
                        {range === null
                          ? `${year}, with no earlier year to set it against.`
                          : `${range}, ${year} against ${entry.previousYear}.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* The cards at the top already carry these figures, and
                          with one project on screen they are the same figures.
                          They earn their place only where there is more than
                          one project for the roll-up to have rolled up. */}
                      {shownProjects.length > 1 &&
                      comparison &&
                      comparison.months.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Value
                            </p>
                            <p className="font-heading text-2xl font-semibold tabular-nums">
                              {currency.format(comparison.current.amount)}
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                from{" "}
                                {currency.format(comparison.previous.amount)}
                              </span>
                            </p>
                            <Delta
                              change={comparison.amountChange}
                              percent={comparison.amountPercent}
                              suffix={currency.format(
                                Math.abs(comparison.amountChange)
                              )}
                            />
                          </div>
                          {tracksUnits ? (
                            <div className="space-y-1">
                              <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Units
                              </p>
                              <p className="font-heading text-2xl font-semibold tabular-nums">
                                {comparison.current.units}
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                  from {comparison.previous.units}
                                </span>
                              </p>
                              <Delta
                                change={comparison.unitChange}
                                percent={comparison.unitPercent}
                                suffix={`${Math.abs(comparison.unitChange)}`}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          By month
                        </p>
                        <YearCompareChart
                          rows={entry.rows}
                          currentYear={year}
                          previousYear={entry.previousYear}
                        />
                      </div>

                      {/* The month chart says when the money came in; this says
                          which building it came from, and how each one did
                          against itself last year. Ranked, so the order is
                          part of the answer. */}
                      {entry.properties.length > 1 ? (
                        <div className="space-y-2">
                          <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
    </div>
  );
}
