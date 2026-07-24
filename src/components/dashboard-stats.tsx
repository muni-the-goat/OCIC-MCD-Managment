import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "good" | "warning" | "critical" | "neutral";

const TONE_COLOR: Record<StatTone, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  neutral: "var(--muted-foreground)",
};

function tint(tone: StatTone, percent: number) {
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
