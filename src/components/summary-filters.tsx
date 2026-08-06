"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { LumaSpin } from "@/components/ui/luma-spin";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { MONTH_NAMES } from "@/lib/types";

const ALL_AUTHORS = "all";

// Shared by both dashboard summaries. The annual budget tab shows year and
// author; the monthly report tab adds a month, because one activity report
// covers a single month and its charts should not be stretched across a year.
export function SummaryFilters({
  years,
  selectedYear,
  months,
  selectedMonth,
  authors,
  selectedAuthor,
  allAuthorsLabel = "All authors",
  // Each tab keeps its own params in the URL, so switching tabs never silently
  // re-filters the other. The ids stay unique with them.
  yearParam = "budget_year",
  monthParam = "budget_month",
  authorParam = "budget_author",
  idPrefix = "annual-budget",
}: {
  years: number[];
  selectedYear: number;
  months?: number[];
  selectedMonth?: number;
  authors: { id: string; label: string }[];
  selectedAuthor?: string;
  allAuthorsLabel?: string;
  yearParam?: string;
  monthParam?: string;
  authorParam?: string;
  idPrefix?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // router.replace keeps the stale summary on screen while the server refetches,
  // with no sign anything is happening. Running it in a transition surfaces that
  // wait as isPending, so a small spinner can sit beside the filters.
  const [isPending, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (key === authorParam && value === ALL_AUTHORS) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Changing the year can land on a month that year has no report for, so the
    // month is cleared and left for the server to re-resolve to a real one.
    if (key === yearParam) params.delete(monthParam);
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
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <ResponsiveSelect
          id={`${idPrefix}-year`}
          className="w-28"
          value={String(selectedYear)}
          onValueChange={(value) => setParam(yearParam, value)}
          options={years.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
        />
      </div>
      {months && selectedMonth ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-month`}>Month</Label>
          <ResponsiveSelect
            id={`${idPrefix}-month`}
            className="w-36"
            value={String(selectedMonth)}
            onValueChange={(value) => setParam(monthParam, value)}
            options={months.map((month) => ({
              value: String(month),
              label: MONTH_NAMES[month - 1],
            }))}
          />
        </div>
      ) : null}
      {authors.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-author`}>Author</Label>
          <ResponsiveSelect
            id={`${idPrefix}-author`}
            className="w-52"
            value={selectedAuthor || ALL_AUTHORS}
            onValueChange={(value) => setParam(authorParam, value)}
            options={[
              { value: ALL_AUTHORS, label: allAuthorsLabel },
              ...authors.map((author) => ({
                value: author.id,
                label: author.label,
              })),
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
