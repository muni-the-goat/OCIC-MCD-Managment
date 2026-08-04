import { redirect } from "next/navigation";
import { ProjectStreamCard } from "@/components/project-stream-card";
import { SummaryFilters } from "@/components/summary-filters";
import { getProfile, seesProjectReports } from "@/lib/auth";
import {
  getProjectYears,
  getStreamYears,
} from "@/lib/project-reports-server";
import { PROJECT_STREAMS } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const [profile, params] = await Promise.all([getProfile(), searchParams]);
  if (!seesProjectReports(profile.role)) redirect("/dashboard");

  const years = await getProjectYears();
  const requested = Number(params.year);
  // An out-of-range year in the URL falls back to the newest year with data
  // rather than rendering three empty cards for 1998.
  const year = years.includes(requested) ? requested : years[0];

  // Three streams, each needing its own year and the one before it. Fetched
  // together — they are independent queries and the page cannot paint until all
  // three have landed anyway.
  const streams = await Promise.all(
    PROJECT_STREAMS.map(async (stream) => ({
      stream,
      ...(await getStreamYears(stream, year)),
    }))
  );

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
        {/* No author filter here: a project report has one compiler, not an
            author per department, so there is nothing to filter by. */}
        <SummaryFilters
          years={years}
          selectedYear={year}
          authors={[]}
          yearParam="year"
          idPrefix="projects"
        />
      </div>

      <div className="space-y-5">
        {streams.map(({ stream, current, previous }) => (
          <ProjectStreamCard
            key={stream}
            stream={stream}
            year={year}
            current={current}
            previous={previous}
          />
        ))}
      </div>
    </div>
  );
}
