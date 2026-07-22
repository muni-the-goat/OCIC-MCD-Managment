"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setParam(yearParam, value)}
        >
          <SelectTrigger id={`${idPrefix}-year`} className="w-28">
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
      {months && selectedMonth ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-month`}>Month</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(value) => setParam(monthParam, value)}
          >
            <SelectTrigger id={`${idPrefix}-month`} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={String(month)}>
                  {MONTH_NAMES[month - 1]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {authors.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-author`}>Author</Label>
          <Select
            value={selectedAuthor || ALL_AUTHORS}
            onValueChange={(value) => setParam(authorParam, value)}
          >
            <SelectTrigger id={`${idPrefix}-author`} className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AUTHORS}>{allAuthorsLabel}</SelectItem>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>
                  {author.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
