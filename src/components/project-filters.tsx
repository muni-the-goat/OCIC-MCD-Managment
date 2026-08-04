"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { LumaSpin } from "@/components/ui/luma-spin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_PROJECTS,
  ALL_STREAMS,
  type ProjectRecord,
} from "@/lib/project-reports";
import { PROJECT_STREAMS, projectStreamLabel } from "@/lib/types";

// Year, project and category. Deliberately not SummaryFilters — that one is
// built around the marketing dashboard's year/month/author triple and adding a
// fourth and fifth optional dimension to it would leave one component serving
// two pages that share nothing but the shape of a <select>.
export function ProjectFilters({
  years,
  selectedYear,
  projects,
  selectedProject,
  selectedStream,
}: {
  years: number[];
  selectedYear: number;
  projects: ProjectRecord[];
  // The sentinel rather than undefined, because Radix Select forbids an
  // empty-string item value and the URL needs to say "all" out loud.
  selectedProject: string;
  selectedStream: string;
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
    if (value === ALL_PROJECTS || value === ALL_STREAMS) params.delete(key);
    else params.set(key, value);
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
      <div className="space-y-1.5">
        <Label htmlFor="projects-category">Category</Label>
        <Select
          value={selectedStream}
          onValueChange={(value) => setParam("category", value)}
        >
          <SelectTrigger id="projects-category" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STREAMS}>All categories</SelectItem>
            {PROJECT_STREAMS.map((stream) => (
              <SelectItem key={stream} value={stream}>
                {projectStreamLabel(stream)}
              </SelectItem>
            ))}
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
