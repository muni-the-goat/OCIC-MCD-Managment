"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Two years side by side, one pair per month — or per report, or per property,
// depending on what the caller puts on the axis. One component for all three
// because the question is the same each time: this year against last, on a
// shared scale.
//
// Two forms, and the axis decides which:
//
//   line — the axis is time. Jan to Dec is an ordered run, the gap between two
//          months means something, and the shape of the year is the thing being
//          read. A line says "this is one quantity moving"; twelve pairs of
//          bars make the reader assemble that shape themselves.
//
//   bar  — the axis is a set of names. Sales, Leasing, Property Management;
//          Elysée, Diamond Bay. Nothing joins one to the next, so a line
//          between them would draw a trend that does not exist. Paired bars put
//          the two magnitudes next to each other, which is the actual question.
//
// Colour: the brand red leads and carries the current year, the year being
// reported on. Last year takes the palette's blue.
//
// It was the neutral graphite first, on the reasoning that last year is
// context. On the page that reasoning did not survive contact — graphite is the
// darkest thing in the palette, so a tall bar in it dominated the card and read
// as the subject rather than the backdrop. Two years are two series, not a
// figure and its background, and they should be two hues.
//
// Slots 1 and 4 of the set in globals.css. Validated as a pair against both
// card surfaces: ΔE 25.7 under deuteranopia against a target of 8, and both
// clear 3:1, so neither series needs a printed value to be legible.

export interface YearCompareRow {
  key: string;
  // Short, for the axis; the tooltip gets the full one.
  label: string;
  full: string;
  // null is "this year did not report this month", which is not the same as a
  // reported zero and must not be drawn as one. On a line it is the difference
  // between a gap and a dive to the axis — the second reads as a month that
  // earned nothing, and someone repeats that in a meeting.
  current: number | null;
  previous: number | null;
}

// Monotone, specifically — not "natural", and not "basis".
//
// Every curve through monthly totals invents figures between the months that
// nobody reported; the question is only how far the invention is allowed to go.
// A natural cubic spline overshoots: run it through Feb near zero and then a
// steep climb to Mar, and it dips the curve *below* zero on the way — a month
// drawn as a loss that was really the smoothing. "basis" is worse still and
// does not pass through the reported points at all.
//
// Monotone cubic is bounded by its own data. It never draws a value above the
// highest neighbouring month or below the lowest, so the curve can round a
// corner but cannot invent a peak that beats April or a month below $0. The
// dots remain the claim about what was actually reported; the curve only joins
// them.
const CURVE = "monotone" as const;

// The dot at each month, in the series' own colour.
//
// recharts hands the dot the *Line's* props as its base, and a Line's default
// fill is #fff — so a dot given only a radius comes out as a white disc on a
// white card, visible only where it happens to sit on the line. The fill has to
// be named, every time.
//
// The ring is the card surface rather than no stroke at all: in May the two
// years cross, and without it the dots merge into one blob at the crossing.
function dot(color: string) {
  return { r: 3.5, fill: color, stroke: "var(--card)", strokeWidth: 1.5 };
}

const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function YearCompareChart({
  rows,
  currentYear,
  previousYear,
  minWidth = 480,
  height = "h-64",
  variant = "bar",
}: {
  rows: YearCompareRow[];
  currentYear: number;
  previousYear: number | null;
  minWidth?: number;
  height?: string;
  variant?: "bar" | "line";
}) {
  const config = {
    previous: {
      label: previousYear === null ? "Last year" : String(previousYear),
      color: "var(--series-4)",
    },
    current: { label: String(currentYear), color: "var(--series-1)" },
  } satisfies ChartConfig;

  // With nothing to compare against, the second series would be a flat run
  // along the axis claiming last year earned nothing — rather than that last
  // year was never reported. It is left out, and the legend with it.
  const hasPrevious =
    previousYear !== null &&
    rows.some((row) => row.previous !== null && row.previous !== 0);

  const isLine = variant === "line";
  const Chart = isLine ? LineChart : BarChart;

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        // The floor width guarantees room for every tick, so render them all
        // rather than letting recharts thin them.
        interval={0}
        className="text-xs"
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        width={64}
        className="text-xs tabular-nums"
        tickFormatter={(value: number) =>
          value === 0 ? "$0" : compact.format(value)
        }
      />
      <ChartTooltip
        cursor={
          isLine
            ? { stroke: "var(--border)", strokeWidth: 1 }
            : { fill: "var(--muted)", opacity: 0.5 }
        }
        isAnimationActive={false}
        content={
          <ChartTooltipContent
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as YearCompareRow | undefined)?.full ?? ""
            }
            formatter={(value, name) => (
              <div className="flex flex-1 items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {config[name as keyof typeof config]?.label ?? name}
                </span>
                <span className="font-medium tabular-nums">
                  {value === null || Number(value) === 0
                    ? "—"
                    : currency.format(Number(value))}
                </span>
              </div>
            )}
          />
        }
      />
      {/* Two series are never told apart by colour alone: the legend names
          them, and the tooltip repeats the year beside every figure. */}
      {hasPrevious ? <ChartLegend content={<ChartLegendContent />} /> : null}
    </>
  );

  return (
    // A phone cannot fit twelve month labels, and dropping every other one
    // hides half the year. The plot keeps a floor width and scrolls inside this
    // box instead, so the page itself never scrolls sideways.
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ChartContainer
        config={config}
        className={`aspect-auto ${height} w-full`}
        style={{ minWidth }}
      >
        <Chart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, right: 12, left: 12, bottom: 0 }}
          // 2px of card surface between the paired bars, so they read as two
          // marks rather than one two-tone one. Ignored by LineChart.
          barGap={2}
        >
          {axes}
          {isLine ? (
            <>
              {hasPrevious ? (
                <Line
                  dataKey="previous"
                  stroke="var(--color-previous)"
                  type={CURVE}
                  strokeWidth={2.5}
                  // Months are readings, not a continuous signal — the dot is
                  // where a number actually exists.
                  dot={dot("var(--color-previous)")}
                  activeDot={{ r: 5 }}
                  // An unreported month stays a gap in the line rather than
                  // being bridged over as though it had been filled in.
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                dataKey="current"
                stroke="var(--color-current)"
                type={CURVE}
                strokeWidth={2.5}
                dot={dot("var(--color-current)")}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              {hasPrevious ? (
                <Bar
                  dataKey="previous"
                  fill="var(--color-previous)"
                  radius={[4, 4, 0, 0]}
                />
              ) : null}
              <Bar
                dataKey="current"
                fill="var(--color-current)"
                radius={[4, 4, 0, 0]}
              />
            </>
          )}
        </Chart>
      </ChartContainer>
    </div>
  );
}
