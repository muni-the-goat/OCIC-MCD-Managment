"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { LumaSpin } from "@/components/ui/luma-spin";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_CATEGORIES,
  ALL_PROJECTS,
  ALL_STREAMS,
  type CategoryOptions,
  type ProjectRecord,
} from "@/lib/project-reports";
import { BUILT_BAND, PROJECT_STREAMS, projectStreamLabel } from "@/lib/types";

// Year, project, report and category. Deliberately not SummaryFilters — that
// one is built around the marketing dashboard's year/month/author triple and
// adding a fourth and fifth optional dimension to it would leave one component
// serving two pages that share nothing but the shape of a <select>.
export function ProjectFilters({
  years,
  selectedYear,
  projects,
  selectedProject,
  selectedStream,
  options,
  selectedCategory,
}: {
  years: number[];
  selectedYear: number;
  projects: ProjectRecord[];
  // The sentinel rather than undefined, because Radix Select forbids an
  // empty-string item value and the URL needs to say "all" out loud.
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
      value === ALL_CATEGORIES
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
        <Select
          value={selectedProject}
          onValueChange={(value) => setParam("project", value)}
        >
          <SelectTrigger id="projects-project" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Sales, leasing, property management: which report you are reading.
          It answered to "Category" until the word was needed for the tiers
          below, where it is the one the Vice President uses. */}
      <div className="space-y-1.5">
        <Label htmlFor="projects-report">Report</Label>
        <Select
          value={selectedStream}
          onValueChange={(value) => setParam("stream", value)}
        >
          <SelectTrigger id="projects-report" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STREAMS}>All reports</SelectItem>
            {PROJECT_STREAMS.map((stream) => (
              <SelectItem key={stream} value={stream}>
                {projectStreamLabel(stream)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* The three tiers in one list, coarsest first, so the reader picks the
          level they want to read at rather than assembling it from two
          controls. The tiers are labelled because "Land" appears in two of
          them and only its heading says which one is being chosen. */}
      <div className="space-y-1.5">
        <Label htmlFor="projects-category">Category</Label>
        <Select
          value={selectedCategory}
          onValueChange={(value) => setParam("category", value)}
        >
          <SelectTrigger id="projects-category" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            <SelectGroup>
              <SelectLabel>Totals</SelectLabel>
              {options.bands.map((band) => (
                <SelectItem key={band} value={`band:${band}`}>
                  {band === BUILT_BAND ? "Total built properties" : "Total land"}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Categories</SelectLabel>
              {options.categories.map((category) => (
                <SelectItem key={category} value={`category:${category}`}>
                  {category}
                </SelectItem>
              ))}
            </SelectGroup>
            {options.properties.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Properties</SelectLabel>
                {options.properties.map((property) => (
                  <SelectItem key={property} value={`property:${property}`}>
                    {property}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="projects-year">Year</Label>
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setParam("year", value)}
        >
          <SelectTrigger id="projects-year" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
