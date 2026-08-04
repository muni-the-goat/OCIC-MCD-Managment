import { redirect } from "next/navigation";
import {
  ProjectMonthForm,
  type StreamRow,
  type StreamRows,
} from "@/components/project-month-form";
import { canEditProjectReports, getProfile } from "@/lib/auth";
import { getProjectYears, getStreamYears } from "@/lib/project-reports-server";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  PROJECT_STREAMS,
  UNIT_KEYS,
  streamTracksUnits,
} from "@/lib/types";

export const metadata = { title: "Project monthly report" };

// A figure of zero shows as an empty box, not "0.00". The distinction is the
// same one the dashboard makes: a month nobody has filled in is not a month that
// earned nothing, and pre-filling zeros would turn every unreported row into a
// reported one the moment somebody saved.
function cell(value: number): string {
  return value === 0 ? "" : String(value);
}

export default async function NewProjectReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  if (!canEditProjectReports(profile.role)) redirect("/dashboard");

  const now = new Date();
  const knownYears = await getProjectYears();
  // The current year is always offerable even if nothing has been filed for it
  // yet — otherwise January is a dead end until someone edits the database.
  const years = Array.from(
    new Set([now.getFullYear(), ...knownYears])
  ).sort((a, b) => b - a);

  const requestedYear = Number(params.year);
  const year = years.includes(requestedYear) ? requestedYear : years[0];

  const requestedMonth = Number(params.month);
  // Defaults to last month rather than this one: a month is compiled once it is
  // over, so in early July the figure being entered is June's.
  const month =
    Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : now.getMonth() === 0
        ? 12
        : now.getMonth();

  const amountKey = MONTH_KEYS[month - 1];
  const unitKey = UNIT_KEYS[month - 1];

  // Rows come from the chosen year's report where one exists, and from the year
  // before it otherwise — a fresh January should offer last year's properties
  // rather than a blank page, since the portfolio rarely changes overnight.
  const streams = await Promise.all(
    PROJECT_STREAMS.map(async (stream) => {
      const { current, previous } = await getStreamYears(stream, year);
      const source = current?.items.length ? current : previous;
      const carriedForward = !current?.items.length;

      const rows: StreamRow[] = (source?.items ?? []).map((item) => ({
        name: item.name,
        // Only the chosen month is loaded, and only from this year's report.
        // A carried-forward row set brings the names, never last year's money.
        amount:
          carriedForward || !current ? "" : cell(Number(item[amountKey] ?? 0)),
        units:
          carriedForward || !current || !streamTracksUnits(stream)
            ? ""
            : cell(Number(item[unitKey] ?? 0)),
      }));

      return [stream, rows.length > 0 ? rows : [emptyRow()]] as const;
    })
  );

  const initialRows = Object.fromEntries(streams) as StreamRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Project monthly report
        </h1>
        <p className="text-sm text-muted-foreground">
          Sales, leasing and property management for {MONTH_NAMES[month - 1]}{" "}
          {year}. Saving writes this month only.
        </p>
      </div>
      <ProjectMonthForm
        years={years}
        initialYear={year}
        initialMonth={month}
        initialRows={initialRows}
      />
    </div>
  );
}

function emptyRow(): StreamRow {
  return { name: "", amount: "", units: "" };
}
