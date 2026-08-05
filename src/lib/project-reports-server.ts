import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRecord } from "@/lib/project-reports";
import type { ProjectReport, ProjectStream } from "@/lib/types";

const SELECT =
  "id, project_id, stream, period_year, updated_at, items:project_report_items(*)";

function sortItems(report: ProjectReport): ProjectReport {
  return {
    ...report,
    items: [...report.items].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    ),
  };
}

// Projects are rows as of migration 0020, the same way departments became rows
// in 0013. cache() dedupes across a single request — the filter bar, the cards
// and the print header each want the list.
export const getProjects = cache(async (): Promise<ProjectRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, label, short, sort_order")
    .order("sort_order")
    .order("label");
  return (data ?? []) as ProjectRecord[];
});

export interface StreamYears {
  current: ProjectReport | null;
  previous: ProjectReport | null;
}

export function streamKey(projectId: string, stream: ProjectStream): string {
  return `${projectId}:${stream}`;
}

// Every project × stream the page is about, for a year and the year before it —
// the pair every card needs, because the workbook is always "2026 against
// 2025".
//
// One query for all of them. It was one per project per stream, six for the
// unfiltered page, fired in parallel: six connections, six round trips, six
// chances to be slow, to fetch rows of one table that differ only by two
// columns. The page waits for the slowest of them before it renders anything,
// so the reader felt the worst of the six every time.
export async function getStreamReports(
  projectIds: string[],
  streams: readonly ProjectStream[],
  year: number
): Promise<Map<string, StreamYears>> {
  const found = new Map<string, StreamYears>();
  if (projectIds.length === 0 || streams.length === 0) return found;

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_reports")
    .select(SELECT)
    .in("project_id", projectIds)
    .in("stream", streams as ProjectStream[])
    .in("period_year", [year, year - 1]);

  const reports = (data ?? []) as unknown as ProjectReport[];

  for (const projectId of projectIds) {
    for (const stream of streams) {
      const mine = reports.filter(
        (report) =>
          report.project_id === projectId && report.stream === stream
      );
      const pick = (y: number) => {
        const report = mine.find((r) => r.period_year === y);
        return report ? sortItems(report) : null;
      };
      found.set(streamKey(projectId, stream), {
        current: pick(year),
        previous: pick(year - 1),
      });
    }
  }

  return found;
}

// Every year any project has data for, newest first — the year picker's
// options. Falls back to the current calendar year so the picker is never empty
// on a fresh database.
export async function getProjectYears(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_reports")
    .select("period_year")
    .order("period_year", { ascending: false });

  const years = Array.from(
    new Set((data ?? []).map((row) => row.period_year as number))
  );
  return years.length > 0 ? years : [new Date().getFullYear()];
}
