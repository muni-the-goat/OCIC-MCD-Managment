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

const ALL_AUTHORS = "all";

export function AnnualBudgetFilters({
  years,
  selectedYear,
  authors,
  selectedAuthor,
  allAuthorsLabel = "All authors",
}: {
  years: number[];
  selectedYear: number;
  authors: { id: string; label: string }[];
  selectedAuthor?: string;
  allAuthorsLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (key === "budget_author" && value === ALL_AUTHORS) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="annual-budget-year">Year</Label>
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setParam("budget_year", value)}
        >
          <SelectTrigger id="annual-budget-year" className="w-28">
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
      {authors.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="annual-budget-author">Author</Label>
          <Select
            value={selectedAuthor || ALL_AUTHORS}
            onValueChange={(value) => setParam("budget_author", value)}
          >
            <SelectTrigger id="annual-budget-author" className="w-52">
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
