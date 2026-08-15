"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { LumaSpin } from "@/components/ui/luma-spin";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import {
  ALL_CATEGORIES,
  ALL_MONTHS,
  ALL_PROJECTS,
  ALL_STREAMS,
  type CategoryOptions,
  type ProjectRecord,
} from "@/lib/project-reports";
import {
  BUILT_BAND,
  MONTH_NAMES,
  PROJECT_STREAMS,
  projectStreamLabel,
} from "@/lib/types";

// Year, month, project, report and category. Deliberately not SummaryFilters —
// that one is built around the marketing dashboard's year/month/author triple
// and adding two more optional dimensions to it would leave one component
// serving two pages that share nothing but the shape of a <select>.
export function ProjectFilters({
  years,
  selectedYear,
  selectedMonth,
  projects,
  selectedProject,
  selectedStream,
  options,
  selectedCategory,
}: {
  years: number[];
  selectedYear: number;
  // The sentinel rather than undefined, because Radix Select forbids an
  // empty-string item value and the URL needs to say "all" out loud.
  selectedMonth: string;
  projects: ProjectRecord[];
  selectedProject: string;
  selectedStream: string;
  options: CategoryOptions;
  selectedCategory: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // router.replace leaves the stale table on screen while the server refetches,
  // with no sign anything is happening. A transition surfaces that wait.
  const [isPending, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    // "all" is the default, so it stays out of the URL — a link someone pastes
    // into a message should carry the filters they actually chose.
    if (
      value === ALL_PROJECTS ||
      value === ALL_STREAMS ||
      value === ALL_CATEGORIES ||
      value === ALL_MONTHS
    ) {
      params.delete(key);
    } else params.set(key, value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {isPending ? (
        <LumaSpin
          size={22}
          className="mb-1.5 self-center text-muted-foreground"
        />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="projects-project">Project</Label>
        <ResponsiveSelect
          id="projects-project"
          className="w-52"
          value={selectedProject}
          onValueChange={(value) => setParam("project", value)}
          options={[
            { value: ALL_PROJECTS, label: "All projects" },
            ...projects.map((project) => ({
              value: project.id,
              label: project.label,
            })),
          ]}
        />
      </div>
      {/* Sales, leasing, property management: which report you are reading.
          It answered to "Category" until the word was needed for the tiers
          below, where it is the one the Vice President uses. */}
      <div className="space-y-1.5">
        <Label htmlFor="projects-report">Report</Label>
        <ResponsiveSelect
          id="projects-report"
          className="w-52"
          value={selectedStream}
          onValueChange={(value) => setParam("stream", value)}
          options={[
            { value: ALL_STREAMS, label: "All reports" },
            ...PROJECT_STREAMS.map((stream) => ({
              value: stream,
              label: projectStreamLabel(stream),
            })),
          ]}
        />
      </div>
      {/* The three tiers in one list, coarsest first, so the reader picks the
          level they want to read at rather than assembling it from two
          controls. The tiers are labelled because "Land" appears in two of
          them and only its heading says which one is being chosen. */}
      <div className="space-y-1.5">
        <Label htmlFor="projects-category">Category</Label>
        <ResponsiveSelect
          id="projects-category"
          className="w-56"
          value={selectedCategory}
          onValueChange={(value) => setParam("category", value)}
          options={[
            { options: [{ value: ALL_CATEGORIES, label: "All categories" }] },
            {
              label: "Totals",
              options: options.bands.map((band) => ({
                value: `band:${band}`,
                label:
                  band === BUILT_BAND
                    ? "Total built properties"
                    : "Total land",
              })),
            },
            {
              label: "Categories",
              options: options.categories.map((category) => ({
                value: `category:${category}`,
                label: category,
              })),
            },
            ...(options.properties.length > 0
              ? [
                  {
                    label: "Properties",
                    options: options.properties.map((property) => ({
                      value: `property:${property}`,
                      label: property,
                    })),
                  },
                ]
              : []),
          ]}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="projects-year">Year</Label>
        <ResponsiveSelect
          id="projects-year"
          className="w-28"
          value={String(selectedYear)}
          onValueChange={(value) => setParam("year", value)}
          options={years.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
        />
      </div>
      {/* Beside the year, because the two name one period between them, and
          read left to right as "2026, March".

          All twelve are offered whether or not the reports reach that far —
          unlike the year, which lists only the years with data. A month is a
          fixed part of the calendar, and a picker that grew a row each time
          somebody filed July would be one whose contents move under the
          reader. Picking a month nothing was filed in says so. */}
      <div className="space-y-1.5">
        <Label htmlFor="projects-month">Month</Label>
        <ResponsiveSelect
          id="projects-month"
          className="w-36"
          value={selectedMonth}
          onValueChange={(value) => setParam("month", value)}
          options={[
            { value: ALL_MONTHS, label: "All months" },
            ...MONTH_NAMES.map((name, index) => ({
              value: String(index + 1),
              label: name,
            })),
          ]}
        />
      </div>
    </div>
  );
}
