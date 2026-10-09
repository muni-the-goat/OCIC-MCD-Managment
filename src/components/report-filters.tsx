"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/liquid-tabs";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { PILL_MENU as MENU } from "@/lib/control-styles";

const ALL = "all";

const STATUSES = [
  { value: ALL, label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

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

  // The pill moves on the click, not when the server answers. The URL is the
  // truth, but it only changes once the new list has been fetched; holding the
  // choice optimistically for the length of that navigation lets the ink set
  // off at once, and it falls back to the URL if the navigation is abandoned.
  const [, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(
    searchParams.get("status") ?? ALL
  );
  const chooseStatus = (value: string) =>
    startTransition(() => {
      setOptimisticStatus(value);
      setParam("status", value);
    });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* Status is the filter people reach for most — "what is waiting", "what
          came back" — so it is one tap on a row of pills rather than a menu to
          open and read. Type and author stay menus: they are rarer, and their
          options do not fit on a line. */}
      <div className="-mx-1 max-w-full overflow-x-auto px-1 py-1">
        <LiquidTabs
          role="filter"
          label="Status"
          options={STATUSES}
          value={status}
          onChange={chooseStatus}
        />
      </div>
      {/* Side by side on a phone, each taking half, rather than wrapping onto
          two staggered lines of different widths. */}
      <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
        <ResponsiveSelect
          className={`w-full sm:w-52 ${MENU}`}
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
        {showAuthorFilter ? (
          <ResponsiveSelect
            className={`w-full sm:w-44 ${MENU}`}
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
          <Button
            variant="ghost"
            className="col-span-2 h-10 justify-self-start rounded-full px-4"
            onClick={() => router.push(pathname)}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
