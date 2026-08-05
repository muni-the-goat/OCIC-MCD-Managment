import { redirect } from "next/navigation";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { PrintPortal } from "@/components/print-portal";
import { PrintableProjectReport } from "@/components/printable-project-report";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectStreamCard } from "@/components/project-stream-card";
import { getProfile, seesProjectReports } from "@/lib/auth";
import {
  ALL_PROJECTS,
  ALL_STREAMS,
  categoryOptions,
  categorySelectionLabel,
  categorySelectionValue,
  filterItems,
  parseCategorySelection,
} from "@/lib/project-reports";
import {
  getProjects,
  getProjectYears,
  getStreamYears,
} from "@/lib/project-reports-server";
import {
  PROJECT_STREAMS,
  projectStreamLabel,
  type ProjectReport,
  type ProjectStream,
} from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
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
  // An out-of-range year in the URL falls back to the newest year with data
  // rather than rendering empty cards for 1998.
  const year = years.includes(requestedYear) ? requestedYear : years[0];

  const projectParam =
    params.project && projects.some((p) => p.id === params.project)
      ? params.project
      : ALL_PROJECTS;
  // ?category= used to carry the report stream, before the word was needed for
  // the Land/Built filter the Vice President asked for. A link shared under the
  // old name still opens on the report it named.
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

  // Every project × stream combination the filters select. "All projects"
  // renders each project as its own block rather than merging them into one
  // table: Koh Pich's Elysee and Chroy Changvar Bay's properties are different
  // buildings, and a merged row set would be a table that exists nowhere in the
  // business.
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

  // The filter offers what these reports actually hold, so it never lists a
  // property belonging to a project the reader has filtered away. Built before
  // the selection is applied — a list narrowed by the very choice it offers
  // would leave the reader unable to choose anything else.
  const options = categoryOptions(
    loaded.flatMap(({ streams }) =>
      streams.flatMap((entry) => entry.current?.items ?? [])
    )
  );
  const selection = parseCategorySelection(params.category, options);

  // Applied to the rows themselves, before any grouping or summing, so every
  // figure downstream — subtotals, totals, the year-on-year comparison — is of
  // what was asked for. Last year is narrowed the same way, or the comparison
  // would set one category against the whole portfolio.
  const narrow = (report: ProjectReport | null) =>
    report ? { ...report, items: filterItems(report.items, selection) } : null;

  const blocks = await Promise.all(
    loaded.map(async ({ project, streams: loadedStreams }) => {
      const streams = loadedStreams.map((entry) => ({
        stream: entry.stream,
        current: narrow(entry.current),
        previous: narrow(entry.previous),
      }));
      return {
        project,
        // A stream a project has never reported is dropped rather than shown
        // empty. Chroy Changvar Bay files no property management report at all,
        // and a card reading "nothing recorded for 2026" would describe a
        // report nobody has filled in — which is a different and wronger claim
        // than "this project does not produce one".
        //
        // Either year counts, so viewing a year ahead of the data still shows
        // the stream with its own empty state rather than making the card
        // vanish and reappear as the year picker moves.
        streams: streams.filter(
          (entry) =>
            (entry.current?.items.length ?? 0) > 0 ||
            (entry.previous?.items.length ?? 0) > 0
        ),
      };
    })
  );

  const scopeLabel = [
    projectParam === ALL_PROJECTS
      ? "All projects"
      : (projects.find((p) => p.id === projectParam)?.label ?? "All projects"),
    streamParam === ALL_STREAMS ? "All reports" : projectStreamLabel(streamParam),
    categorySelectionLabel(selection),
  ].join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Sales, leasing and property management across OCIC&apos;s projects,
            each year set against the one before it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ProjectFilters
            years={years}
            selectedYear={year}
            projects={projects}
            selectedProject={projectParam}
            selectedStream={streamParam}
            options={options}
            selectedCategory={categorySelectionValue(selection)}
          />
          <div className="mb-0.5">
            <ExportPdfButton label="Export PDF" />
          </div>
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          No projects have been set up yet.
        </p>
      ) : (
        blocks.map(({ project, streams }) => (
          <section key={project.id} className="space-y-5">
            {/* The project name only earns a heading when more than one is on
                screen. With a single project selected it would restate the
                filter directly above it. */}
            {shownProjects.length > 1 ? (
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {project.label}
              </h2>
            ) : null}
            {streams.length === 0 ? (
              <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                {project.label} has nothing recorded for {year}.
              </p>
            ) : (
              streams.map(({ stream, current, previous }) => (
                <ProjectStreamCard
                  key={`${project.id}:${stream}`}
                  stream={stream}
                  year={year}
                  current={current}
                  previous={previous}
                  selection={selection}
                />
              ))
            )}
          </section>
        ))
      )}

      {/* Hidden on screen, revealed by the print stylesheet. It prints exactly
          what the filters select, so the PDF and the page can never disagree
          about what the reader was looking at when they pressed Export. */}
      <PrintPortal>
        <PrintableProjectReport
          year={year}
          scopeLabel={scopeLabel}
          blocks={blocks}
          selection={selection}
          presenter={profile.full_name || profile.email}
        />
      </PrintPortal>
    </div>
  );
}
