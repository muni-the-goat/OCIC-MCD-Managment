import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "good" | "warning" | "critical" | "neutral";

export const TONE_COLOR: Record<StatTone, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  neutral: "var(--muted-foreground)",
};

export function tint(tone: StatTone, percent: number) {
  return `color-mix(in oklab, ${TONE_COLOR[tone]} ${percent}%, transparent)`;
}

function share(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

// Semicircular gauge. pathLength normalises the arc to 100 units so the dash
// array is the percentage itself, with no arc-length arithmetic.
function Gauge({ percent, tone }: { percent: number; tone: StatTone }) {
  // Half of a 42-radius circle centred at (50, 50); the 9px stroke and its
  // round caps stay inside the 56-unit-tall viewBox.
  const arc = "M 8 50 A 42 42 0 0 1 92 50";
  return (
    <svg
      viewBox="0 0 100 56"
      className="h-14 w-24"
      role="img"
      aria-label={`${percent}% of all reports`}
    >
      <path
        d={arc}
        fill="none"
        strokeWidth={9}
        strokeLinecap="round"
        className="stroke-foreground/10"
      />
      {percent > 0 ? (
        <path
          d={arc}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
          // Draws the arc in on mount; collapses to the final state under
          // prefers-reduced-motion. Keyframe lives in globals.css.
          className="animate-gauge"
        />
      ) : null}
      <text
        x="50"
        y="48"
        textAnchor="middle"
        className="fill-foreground font-heading text-[16px] font-semibold"
      >
        {percent}%
      </text>
    </svg>
  );
}

export function GaugeStatCard({
  label,
  caption,
  value,
  total,
  tone,
  icon: Icon,
  href,
}: {
  label: string;
  caption: string;
  value: number;
  total: number;
  tone: StatTone;
  icon: LucideIcon;
  // When set, the whole card links to a pre-filtered Reports list.
  href?: string;
}) {
  const card = (
    <Card
      className={cn(
        "h-full rounded-2xl transition",
        href &&
          "group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-md"
      )}
    >
      <CardContent className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full"
              style={{
                backgroundColor: tint(tone, 16),
                color: TONE_COLOR[tone],
              }}
            >
              <Icon className="size-4" />
            </span>
            <p className="font-label text-sm font-medium">{label}</p>
          </div>
          {href ? (
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <CountUp
              value={value}
              className="block font-heading text-4xl font-semibold tabular-nums"
            />
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
          </div>
          <Gauge percent={share(value, total)} tone={tone} />
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${label}: ${value}. View these reports.`}
    >
      {card}
    </Link>
  );
}

export interface MixSegment {
  label: string;
  value: number;
  tone: StatTone;
  // When set, the legend row links to a pre-filtered Reports list.
  href?: string;
}

export function StatusMix({
  segments,
  total,
}: {
  segments: MixSegment[];
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 gap-0.5 rounded-full bg-muted">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span
              key={segment.label}
              className="rounded-full"
              style={{
                flexGrow: segment.value,
                backgroundColor: TONE_COLOR[segment.tone],
              }}
            />
          ) : null
        )}
      </div>
      <ul className="space-y-1">
        {segments.map((segment) => {
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TONE_COLOR[segment.tone] }}
                />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">
                  {segment.value}
                </span>{" "}
                · {share(segment.value, total)}%
              </span>
            </>
          );
          return (
            <li key={segment.label}>
              {segment.href ? (
                <Link
                  href={segment.href}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row}
                </Link>
              ) : (
                <span className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                  {row}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface BandCell {
  label: string;
  caption: string;
  value: number;
  tone: StatTone;
  href: string;
}

// The dashboard's one row of numbers. It replaces three gauge cards and a
// "Status mix" card that sat lower down and restated the same three counts —
// the page printed every figure twice. One band split by hairlines, four
// cells, the fourth being drafts, which the gauges never showed.
//
// Each cell is a link to the filtered list, and the whole cell is the target.
// The meter is 4px: a semicircle spent a lot of ink restating a percentage the
// figure beside it already carried, and a bar says the same thing quietly.
export function StatusBand({
  cells,
  total,
}: {
  cells: BandCell[];
  total: number;
}) {
  return (
    <ul className="grid grid-cols-2 overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/10 lg:grid-cols-4">
      {cells.map((cell, index) => {
        const percent = share(cell.value, total);
        return (
          <li
            key={cell.label}
            className={cn(
              // Hairlines between cells, never around the outside: two columns
              // on a phone, four from lg.
              "border-foreground/10",
              index % 2 === 1 && "border-l",
              index >= 2 && "border-t lg:border-t-0",
              index === 2 && "lg:border-l"
            )}
          >
            <Link
              href={cell.href}
              aria-label={`${cell.label}: ${cell.value} of ${total}. View these reports.`}
              className="group flex h-full flex-col gap-3 p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TONE_COLOR[cell.tone] }}
                  />
                  <span className="truncate">{cell.label}</span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </span>
              <span className="flex items-baseline gap-2">
                <CountUp
                  value={cell.value}
                  className="font-heading text-3xl leading-none font-semibold tabular-nums"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {percent}%
                </span>
              </span>
              <span
                aria-hidden
                className="h-1 overflow-hidden rounded-full bg-foreground/10"
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: TONE_COLOR[cell.tone],
                  }}
                />
              </span>
              <span className="text-xs text-muted-foreground">
                {cell.caption}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
