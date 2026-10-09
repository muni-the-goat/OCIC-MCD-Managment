"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResponsiveSelect } from "@/components/ui/responsive-select";

const ALL = "all";

// The two menus wear the pills' shape and surface, so the filter row reads as
// one control set rather than pills beside form fields. The size is set on the
// data attribute because the trigger's own h-9 is written there and would
// otherwise win.
const MENU =
  "h-10 data-[size=default]:h-10 rounded-full border-transparent bg-card px-4 shadow-none";

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

  const status = searchParams.get("status") ?? ALL;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* Status is the filter people reach for most — "what is waiting", "what
          came back" — so it is one tap on a row of pills rather than a menu to
          open and read. Type and author stay menus: they are rarer, and their
          options do not fit on a line. */}
      <div
        role="group"
        aria-label="Status"
        className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5"
      >
        {STATUSES.map((option) => {
          const active = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setParam("status", option.value)}
              className={
                "type-callout inline-flex h-10 shrink-0 items-center rounded-full px-4 font-semibold whitespace-nowrap outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] active:duration-100 motion-reduce:active:scale-100 " +
                (active
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {option.label}
            </button>
          );
        })}
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
