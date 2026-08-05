import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ProjectFilters } from "@/components/project-filters";
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
  currency,
  filterItems,
  monthTotals,
  parseCategorySelection,
  reportedMonths,
} from "@/lib/project-reports";
import {
  getProjects,
  getProjectYears,
  getStreamYears,
} from "@/lib/project-reports-server";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  PROJECT_STREAMS,
  projectStreamLabel,
  streamTracksUnits,
  type ProjectReport,
  type ProjectStream,
} from "@/lib/types";

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

  const loaded = await Promise.all(
    shownProjects.map(async (project) => ({
      project,
      streams: await Promise.all(
        shownStreams.map(async (stream) => ({
          stream,
          ...(await getStreamYears(project.id, stream, year)),
        }))
      ),
    }))
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Bonjour, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome to the MCD projects dashboard — {year}
            {previousYear === null ? "" : ` against ${previousYear}`}, across
            OCIC&apos;s sales, leasing and property management.
          </p>
        </div>
        <ProjectFilters
          years={years}
          selectedYear={year}
          projects={projects}
          selectedProject={projectParam}
          selectedStream={streamParam}
          options={options}
          selectedCategory={categorySelectionValue(selection)}
        />
      </div>

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
                      {comparison && comparison.months.length > 0 ? (
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

                      <YearCompareChart
                        rows={entry.rows}
                        currentYear={year}
                        previousYear={entry.previousYear}
                      />
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
