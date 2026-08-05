import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Gauge,
  TONE_COLOR,
  tint,
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

  // This year as a share of last year, which is what the arc is drawing. A year
  // that has doubled fills the arc and stops; the figure beside it carries the
  // rest, and an arc that wrapped past its own start would say less than that.
  const share =
    previous > 0 ? Math.min(100, Math.round((value / previous) * 100)) : 0;

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: tint(tone, 16), color: TONE_COLOR[tone] }}
          >
            <Icon className="size-4" />
          </span>
          <p className="font-label text-sm font-medium">{label}</p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">
              {currency.format(value)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              from {currency.format(previous)}
              {units === undefined || previousUnits === undefined
                ? ""
                : ` · ${units} units, from ${previousUnits}`}
            </p>
            <p
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium tabular-nums"
              style={{ color: TONE_COLOR[tone] }}
            >
              {/* The direction is in the word and the arrow as well as the
                  colour: a rise and a fall must not be told apart by hue. */}
              <Direction className="size-4" aria-hidden />
              <span>
                {flat
                  ? "No change"
                  : `${up ? "Up" : "Down"} ${currency.format(Math.abs(change))}`}
                {percent === null ? "" : ` · ${Math.abs(percent).toFixed(1)}%`}
              </span>
            </p>
          </div>
          {previous > 0 ? (
            <Gauge percent={share} tone={tone} label={`${share}% of last year`} />
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}
