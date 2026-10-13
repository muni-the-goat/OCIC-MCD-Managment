import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import {
  TONE_COLOR,
  tint,
  toneText,
  type StatTone,
} from "@/components/dashboard-stats";
import { currency } from "@/lib/project-reports";

// A report's year, set against the one before it. The projects answer to
// GaugeStatCard, which counts reports rather than money and so measures a share
// of a whole; here there is no whole to be a share of. The gauge measures this
// year against last instead — the only ratio the card is actually about.
//
// Colour is the reserved status palette doing its own job: the tone is the
// direction of travel, and it dresses the icon, the gauge and the delta line
// together so they cannot disagree. The categorical hues stay with the charts
// below, where they mean the two years; two colour languages on one page would
// have red meaning "this year" in one place and "down" in another.
export function ProjectStatCard({
  label,
  caption,
  icon: Icon,
  value,
  previous,
  change,
  percent,
  units,
  previousUnits,
}: {
  label: string;
  caption: string;
  icon: LucideIcon;
  value: number;
  previous: number;
  change: number;
  percent: number | null;
  units?: number;
  previousUnits?: number;
}) {
  const flat = change === 0;
  const up = change > 0;
  const tone: StatTone = flat ? "neutral" : up ? "good" : "critical";
  const Direction = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    // The marketing dashboard's card: a white surface with no ring, the label
    // as a headline, the figure carrying the weight. The icon keeps its tinted
    // disc here because the three reports are told apart by it at a glance,
    // which four report statuses never needed.
    <div className="flex h-full flex-col rounded-[1.25rem] bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: tint(tone, 16), color: TONE_COLOR[tone] }}
        >
          <Icon className="size-[1.125rem]" />
        </span>
        <p className="type-headline truncate">{label}</p>
      </div>

      <div className="mt-4 min-w-0">
        {/* Below the 52px of a status count: a currency figure runs to
            fourteen characters, and at that size it would not fit a third of
            a laptop screen. */}
        <p className="font-heading text-[1.75rem] leading-tight font-bold tracking-[-0.02em] tabular-nums sm:text-[2rem]">
          {currency.format(value)}
        </p>
        <p className="type-callout mt-1 text-muted-foreground">
          from {currency.format(previous)}
          {units === undefined || previousUnits === undefined
            ? ""
            : ` · ${units} units, from ${previousUnits}`}
        </p>
      </div>

      {/* The change against last year, which is the reason the card exists.
          It replaced an arc drawing this year as a share of last: the arc
          filled at 100% and stopped, so every report that beat its own last
          year drew the same full sweep whether it was up by one per cent or
          by forty. This says which. */}
      <div className="mt-auto min-w-0 pt-5">
        <p
          className="type-callout inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 font-semibold tabular-nums"
          style={{
            backgroundColor: tint(tone, 12),
            color: toneText(tone),
          }}
        >
          {/* The direction is in the word and the arrow as well as the
              colour: a rise and a fall must not be told apart by hue. */}
          <Direction className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {flat
              ? "No change"
              : `${up ? "Up" : "Down"} ${currency.format(Math.abs(change))}`}
            {percent === null ? "" : ` · ${Math.abs(percent).toFixed(1)}%`}
          </span>
        </p>
        <p className="type-caption mt-2.5 text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}
