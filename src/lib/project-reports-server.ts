import { createClient } from "@/lib/supabase/server";
import type { ProjectReport, ProjectStream } from "@/lib/types";

// Reads a stream's report for a year and the year before it, which is the pair
// every card on the projects dashboard needs — the workbook is always "2026
// against 2025". One query for both, because two round trips for two rows of
// the same table is two chances to be slow for no reason.
export async function getStreamYears(
  stream: ProjectStream,
  year: number
): Promise<{ current: ProjectReport | null; previous: ProjectReport | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_reports")
    .select(
      "id, stream, period_year, updated_at, items:project_report_items(*)"
    )
    .eq("stream", stream)
    .in("period_year", [year, year - 1]);

  const reports = (data ?? []) as unknown as ProjectReport[];
  const find = (y: number) =>
    reports.find((report) => report.period_year === y) ?? null;

  const sortItems = (report: ProjectReport | null) =>
    report
      ? {
          ...report,
          items: [...report.items].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
          ),
        }
      : null;

  return { current: sortItems(find(year)), previous: sortItems(find(year - 1)) };
}

// Every year any stream holds data for, newest first — the year picker's
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
