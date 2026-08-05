"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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

// Two years side by side, one pair of bars per month — or per report, or per
// category, depending on what the caller puts on the axis. One component for
// all three because the question is the same each time: this year against last,
// on a shared scale.
//
// Bars rather than lines. The reader is comparing two magnitudes at the same
// point on the axis — June against June — and paired bars put those two numbers
// next to each other. A line pair asks the eye to measure a vertical gap
// between two points instead, which is the right form for a trend and the wrong
// one for a comparison.
//
// Colour: the brand red leads and carries the current year, the year being
// reported on. Last year takes the neutral graphite, which belongs to no
// category and reads as context — which is what it is here. Both clear 3:1 on
// the card in either theme, so neither bar needs a printed value to be legible;
// the palette they come from is validated as a set in globals.css.

export interface YearCompareRow {
  key: string;
  // Short, for the axis; the tooltip gets the full one.
  label: string;
  full: string;
  current: number;
  previous: number;
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
}: {
  rows: YearCompareRow[];
  currentYear: number;
  previousYear: number | null;
  minWidth?: number;
  height?: string;
}) {
  const config = {
    previous: {
      label: previousYear === null ? "Last year" : String(previousYear),
      color: "var(--series-neutral)",
    },
    current: { label: String(currentYear), color: "var(--series-1)" },
  } satisfies ChartConfig;

  // With nothing to compare against, the second series would be a row of zero
  // bars claiming last year earned nothing — rather than that last year was
  // never reported. It is left out, and the legend with it.
  const hasPrevious =
    previousYear !== null && rows.some((row) => row.previous !== 0);

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
        <BarChart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, right: 12, left: 12, bottom: 0 }}
          // 2px of card surface between the paired bars, so they read as two
          // marks rather than one two-tone one.
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            // The floor width guarantees room for every tick, so render them
            // all rather than letting recharts thin them.
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
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as YearCompareRow | undefined)?.full ??
                  ""
                }
                formatter={(value, name) => (
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {config[name as keyof typeof config]?.label ?? name}
                    </span>
                    <span className="font-medium tabular-nums">
                      {Number(value) === 0
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
        </BarChart>
      </ChartContainer>
    </div>
  );
}
