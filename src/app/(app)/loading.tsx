"use client";

import { usePathname } from "next/navigation";
import {
  DashboardSkeleton,
  PageSkeleton,
  ReportDetailSkeleton,
  ReportFormSkeleton,
  ReportsListSkeleton,
} from "@/components/page-skeletons";

// Shown while a navigation into a different section of the app resolves on the
// server — Dashboard to Reports, Reports to Users. It draws the skeleton of the
// page being opened rather than a spinner, so the reader sees where things are
// about to land and nothing jumps when they do.
//
// One boundary here, chosen by path, rather than a loading.tsx beside each
// page. A loading.tsx wraps its page under a key that includes the query
// string, so the dashboard's year filter or the Reports status pills would
// swap the whole page — filters, tabs and all — for a skeleton on every click,
// and reset whichever tab was open. This boundary sits above those pages, so
// it only shows on the way in. Filter changes stream inside the page instead,
// behind skeletons of just the part that changes.
//
// The projects pages keep their own boundary in projects/loading.tsx, which is
// nearer to them than this one and wins.
export default function AppLoading() {
  const pathname = usePathname();

  if (pathname === "/dashboard") return <DashboardSkeleton />;
  if (pathname === "/reports") return <ReportsListSkeleton />;
  if (pathname === "/reports/new" || pathname.endsWith("/edit")) {
    return <ReportFormSkeleton />;
  }
  if (pathname.startsWith("/reports/")) return <ReportDetailSkeleton />;
  return <PageSkeleton />;
}
