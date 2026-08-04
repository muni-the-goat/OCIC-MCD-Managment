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

// One project's stream for a year and the year before it, which is the pair
// every card needs — the workbook is always "2026 against 2025". One query for
// both, because two round trips for two rows of the same table is two chances
// to be slow for no reason.
export async function getStreamYears(
  projectId: string,
  stream: ProjectStream,
  year: number
): Promise<{ current: ProjectReport | null; previous: ProjectReport | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_reports")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("stream", stream)
    .in("period_year", [year, year - 1]);

  const reports = (data ?? []) as unknown as ProjectReport[];
  const find = (y: number) =>
    reports.find((report) => report.period_year === y) ?? null;

  const current = find(year);
  const previous = find(year - 1);
  return {
    current: current ? sortItems(current) : null,
    previous: previous ? sortItems(previous) : null,
  };
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
