"use client";

import { usePathname } from "next/navigation";
import {
  ProjectFormSkeleton,
  ProjectsDashboardSkeleton,
  ProjectsTablesSkeleton,
} from "@/components/page-skeletons";

// The projects pages read a year of every project's reports, so they take long
// enough that a click with no answer reads as a click that did not register.
//
// (app)/loading.tsx already existed, but it sits directly under the shared app
// layout — far above these routes, and on a client navigation Next only
// re-renders below the layout the two routes share. A boundary here, inside the
// projects segment, is the one these navigations actually enter.
//
// It draws the skeleton of the page being opened, chosen by path, in the same
// surfaces as the marketing pages' skeletons: the reader sees where the figures
// are about to be, which is a better answer to "did my click land" than a
// turning circle.
export default function ProjectsLoading() {
  const pathname = usePathname();

  if (pathname === "/projects/dashboard") return <ProjectsDashboardSkeleton />;
  if (pathname === "/projects/new") return <ProjectFormSkeleton />;
  return <ProjectsTablesSkeleton />;
}
