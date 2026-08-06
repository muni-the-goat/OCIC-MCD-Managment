"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResponsiveSelect } from "@/components/ui/responsive-select";

const ALL = "all";

export function ReportFilters({
  authors,
  showAuthorFilter,
}: {
  authors: { id: string; label: string }[];
  showAuthorFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasFilters = ["type", "status", "author"].some((k) =>
    searchParams.has(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ResponsiveSelect
        className="w-52"
        aria-label="Report type"
        placeholder="Type"
        value={searchParams.get("type") ?? ALL}
        onValueChange={(v) => setParam("type", v)}
        options={[
          { value: ALL, label: "All report types" },
          { value: "budget-monthly", label: "Monthly Budget Report" },
          { value: "monthly", label: "Monthly Activity Report" },
        ]}
      />
      <ResponsiveSelect
        className="w-36"
        aria-label="Status"
        placeholder="Status"
        value={searchParams.get("status") ?? ALL}
        onValueChange={(v) => setParam("status", v)}
        options={[
          { value: ALL, label: "All statuses" },
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
          { value: "reviewed", label: "Reviewed" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
      {showAuthorFilter ? (
        <ResponsiveSelect
          className="w-44"
          aria-label="Author"
          placeholder="Author"
          value={searchParams.get("author") ?? ALL}
          onValueChange={(v) => setParam("author", v)}
          options={[
            { value: ALL, label: "All authors" },
            ...authors.map((author) => ({
              value: author.id,
              label: author.label,
            })),
          ]}
        />
      ) : null}
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
