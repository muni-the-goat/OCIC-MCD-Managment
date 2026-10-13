"use client";

import { useCallback, useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
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

// The chart draws itself in: for an area, recharts widens a clip path from left
// to right, so the year arrives month by month in the order it happened. That
// is the one animation this chart has any business doing — it is the shape of
// the data, not decoration laid over it.
//
// recharts' own default is 1500ms, which is a long time to wait for a figure
// when a card carries three charts and the page carries several cards. Short
// enough to feel immediate, long enough to see the direction of the year.
const DRAW_MS = 700;

// Last year lays down first and this year arrives over it. Small enough to read
// as one gesture rather than two separate charts loading.
const STAGGER_MS = 110;

// Left deliberately alone: isAnimationActive. Its default is "auto", which
// recharts resolves to "animate unless the reader asked their system for
// reduced motion, and never during SSR". Setting it to true would override
// somebody's accessibility preference; these were set to false while the chart
// was being built, which is what stopped it animating at all.

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
  return { r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 };
}

// The hovered month's dot grows and keeps its ring, so it reads as the same
// mark answering the pointer rather than a second one laid over it.
function activeDot(color: string) {
  return { r: 6, fill: color, stroke: "var(--card)", strokeWidth: 2.5 };
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

// Draws when the reader arrives at it, not when the page loads.
//
// recharts starts its animation on mount, and a dashboard mounts every chart at
// once — so the third card down had finished drawing itself before anyone had
// scrolled far enough to see it, and arrived as a static picture. The chart is
// held back until it is actually on screen.
//
// It does not reset on the way back up. Replaying the year every time the
// reader scrolls past is a fidget rather than information.
function useDrawOnScroll<T extends HTMLElement>() {
  const [seen, setSeen] = useState(false);

  // A callback ref rather than an effect: it runs at commit with the node
  // already in hand, so there is no second render spent discovering it, and the
  // no-observer fallback below can set state without fighting the lint rule
  // against setState inside an effect.
  const ref = useCallback(
    (node: T | null) => {
      if (node == null || seen) return;

      // No observer is a reason to show the chart, never a reason to withhold
      // it — a figure that will not render is worse than one that will not
      // move.
      if (typeof IntersectionObserver === "undefined") {
        setSeen(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setSeen(true);
          observer.disconnect();
        },
        // A fifth of the card showing, and a little past the bottom edge, so it
        // begins once the reader is looking at it rather than as the top pixel
        // clears the fold.
        { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [seen]
  );

  return { ref, seen };
}

// Where the year is going, on the pair's own scale: what changed against
// last year as a share of last year. Null where last year has nothing to be a
// share of — a percentage of zero is not a figure.
function changeOf(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function signedPercent(percent: number) {
  // A real minus sign, not a hyphen: it is the width of the plus beside it,
  // so a column of changes does not jitter.
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

// The label over a pair of bars: this year's figure, and its change on last
// year underneath. One per pair rather than a number on every bar — the pair
// is the thing being compared, and two figures side by side over two narrow
// bars collide at any useful size.
//
// Both bars carry this LabelList and each draws it only when it is the taller
// of its pair, so the label always clears both bars. Measuring the taller bar
// from the shorter one's geometry would need the axis scale, which a label is
// not handed; the taller bar's own top is exact.
//
// Passed as an element, not a function: recharts mounts a function as a
// component, so a fresh one each render would remount every label. It clones
// an element instead, adding the bar's index and geometry to these props.
function PairLabel({
  rows,
  series,
  hasPrevious,
  index,
  viewBox,
}: {
  rows: YearCompareRow[];
  series: "current" | "previous";
  hasPrevious: boolean;
  index?: number;
  viewBox?: unknown;
}) {
  const row = index === undefined ? undefined : rows[index];
  const box = viewBox as
    | { x?: number; y?: number; width?: number }
    | undefined;
  if (!row || !box || box.x === undefined || box.y === undefined) {
    return null;
  }
  const current = row.current ?? 0;
  const previous = hasPrevious ? (row.previous ?? 0) : 0;
  if (current <= 0 && previous <= 0) return null;

  // Ties go to this year, so exactly one bar of the pair draws it.
  const tallest = current >= previous ? "current" : "previous";
  if (tallest !== series) return null;

  const width = box.width ?? 0;
  // The middle of the pair: the 2px gap sits between the two bars, last
  // year on the left.
  const x = !hasPrevious
    ? box.x + width / 2
    : series === "current"
      ? box.x - 1
      : box.x + width + 1;
  const change = hasPrevious ? changeOf(row.current, row.previous) : null;

  return (
    <text x={x} textAnchor="middle" className="tabular-nums">
      <tspan
        x={x}
        y={box.y - (change === null ? 8 : 24)}
        className="fill-foreground text-xs font-semibold"
      >
        {/* A reported zero is a figure, and the change beside it says
            what it fell from; only a year that never reported is a dash. */}
        {row.current === null ? "—" : compact.format(row.current)}
      </tspan>
      {change === null ? null : (
        <tspan
          x={x}
          y={box.y - 8}
          className="fill-muted-foreground text-[0.6875rem]"
        >
          {signedPercent(change)}
        </tspan>
      )}
    </text>
  );
}

// The hover readout. Values lead and the year follows, the legend's order
// inverted: by the time the reader is hovering they know which colour is which
// and want the number. Each row is keyed by a short stroke of its series —
// a filled box at this density is ink doing a label's job.
//
// Last year first, then this year, then what changed: it reads as a sentence,
// "from this, to this, by this much", in the same left-to-right order as the
// bars.
function CompareTooltip({
  active,
  payload,
  currentLabel,
  previousLabel,
  hasPrevious,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  currentLabel: string;
  previousLabel: string;
  hasPrevious: boolean;
}) {
  const row = payload?.[0]?.payload as YearCompareRow | undefined;
  if (!active || !row) return null;

  const lines = [
    ...(hasPrevious
      ? [
          {
            key: "previous",
            label: previousLabel,
            value: row.previous,
            color: "var(--color-previous)",
          },
        ]
      : []),
    {
      key: "current",
      label: currentLabel,
      value: row.current,
      color: "var(--color-current)",
    },
  ];
  const change = hasPrevious ? changeOf(row.current, row.previous) : null;
  const difference =
    row.current !== null && row.previous !== null
      ? row.current - row.previous
      : null;

  return (
    <div className="min-w-48 rounded-xl bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-foreground/[0.08]">
      <p className="type-caption mb-2 font-semibold">{row.full}</p>
      <div className="space-y-1.5">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-[3px] w-3 shrink-0 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span className="type-caption text-muted-foreground">
              {line.label}
            </span>
            <span className="type-callout ml-auto pl-4 font-semibold tabular-nums">
              {line.value === null || line.value === 0
                ? "—"
                : currency.format(line.value)}
            </span>
          </div>
        ))}
      </div>
      {hasPrevious && difference !== null ? (
        <ChangeRows difference={difference} percent={change} />
      ) : null}
    </div>
  );
}

// The change, in two rows: the amount, then the share of last year. One line
// carrying both ran to "+$2.3K · +0.9%", and the reader had to split it to read
// either.
//
// Coloured by direction — the status palette's green for a rise, red for a
// fall — because that is the answer the reader hovered for. Never by colour
// alone: the arrow and the sign say it too, for a reader who cannot tell the
// two apart. The raw status hues are fills, not ink (the green is barely 3:1
// on white), so the text is mixed most of the way toward the foreground: the
// hue survives and the figures stay readable.
function ChangeRows({
  difference,
  percent,
}: {
  difference: number;
  percent: number | null;
}) {
  const direction = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;
  const color =
    direction === "flat"
      ? "var(--muted-foreground)"
      : `color-mix(in oklab, var(--status-${direction === "up" ? "good" : "critical"}) 72%, var(--foreground))`;
  const sign = direction === "up" ? "+" : direction === "down" ? "\u2212" : "";

  return (
    <div className="mt-2 space-y-1.5 border-t pt-2">
      <div className="flex items-center gap-2.5">
        <span className="type-caption text-muted-foreground">Change</span>
        <span
          className="type-callout ml-auto inline-flex items-center gap-1 pl-4 font-semibold tabular-nums"
          style={{ color }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {direction === "flat"
            ? "No change"
            : `${sign}${currency.format(Math.abs(difference))}`}
        </span>
      </div>
      {percent === null || direction === "flat" ? null : (
        <div className="flex items-center gap-2.5">
          <span className="type-caption text-muted-foreground">
            Percentage
          </span>
          <span
            className="type-callout ml-auto pl-4 font-semibold tabular-nums"
            style={{ color }}
          >
            {signedPercent(percent)}
          </span>
        </div>
      )}
    </div>
  );
}

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
  const previousLabel = previousYear === null ? "Last year" : String(previousYear);
  const currentLabel = String(currentYear);
  const config = {
    previous: { label: previousLabel, color: "var(--series-4)" },
    current: { label: currentLabel, color: "var(--series-1)" },
  } satisfies ChartConfig;

  // With nothing to compare against, the second series would be a flat run
  // along the axis claiming last year earned nothing — rather than that last
  // year was never reported. It is left out, and the legend with it.
  const hasPrevious =
    previousYear !== null &&
    rows.some((row) => row.previous !== null && row.previous !== 0);

  const { ref, seen } = useDrawOnScroll<HTMLDivElement>();

  const isLine = variant === "line";
  const Chart = isLine ? AreaChart : BarChart;

  // Three of these render per card and several cards per page, so a fixed
  // gradient id would have every chart on the page pointing at whichever <defs>
  // mounted last.
  const gradientId = useId().replace(/:/g, "");

  const axes = (
    <>
      {/* Hairlines one step off the card, solid: the grid is there to be
          read against, not looked at. */}
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tickMargin={10}
        // The floor width guarantees room for every tick, so render them all
        // rather than letting recharts thin them.
        interval={0}
        className="text-xs"
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        width={56}
        tickCount={5}
        className="text-xs tabular-nums"
        tickFormatter={(value: number) =>
          value === 0 ? "$0" : compact.format(value)
        }
      />
      <ChartTooltip
        // A line is aimed at by month, never by its 2px stroke, so a hairline
        // follows the pointer to the nearest one. A bar is its own target; the
        // slot behind it only tints, enough to say which pair is being read.
        cursor={
          isLine
            ? { stroke: "var(--foreground)", strokeOpacity: 0.18, strokeWidth: 1 }
            : { fill: "var(--foreground)", fillOpacity: 0.035 }
        }
        isAnimationActive={false}
        content={
          <CompareTooltip
            currentLabel={currentLabel}
            previousLabel={previousLabel}
            hasPrevious={hasPrevious}
          />
        }
      />
    </>
  );

  return (
    <div className="space-y-3">
      {/* Above the plot, in the order the bars stand — last year on the left
          — and keyed by the mark's own shape: a block for a bar, a stroke for
          a line. A single series needs none; the card's title names it. */}
      {hasPrevious ? (
        <ul className="type-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground/80">
          {(
            [
              ["previous", previousLabel, "var(--series-4)"],
              ["current", currentLabel, "var(--series-1)"],
            ] as const
          ).map(([key, label, color]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={
                  isLine ? "h-[3px] w-3.5 rounded-full" : "size-2.5 rounded-[3px]"
                }
                style={{ backgroundColor: color }}
              />
              {label}
            </li>
          ))}
        </ul>
      ) : null}

      {/* A phone cannot fit twelve month labels, and dropping every other one
          hides half the year. The plot keeps a floor width and scrolls inside
          this box instead, so the page itself never scrolls sideways. */}
      <div ref={ref} className="-mx-1 overflow-x-auto px-1 pb-1">
        {!seen ? (
          // Holds the exact space the chart will take, so arriving at the card
          // does not shove the rest of the page down as it draws.
          <div className={`${height} w-full`} style={{ minWidth }} />
        ) : (
          <ChartContainer
            config={config}
            className={`aspect-auto ${height} w-full`}
            style={{ minWidth }}
          >
            <Chart
              accessibilityLayer
              data={rows}
              // Headroom over the bars for the pair labels.
              margin={{ top: isLine ? 12 : 36, right: 12, left: 4, bottom: 0 }}
              // 2px of card surface between the paired bars, so they read as
              // two marks rather than one two-tone one. Ignored by AreaChart.
              barGap={2}
            >
              {isLine ? (
                <defs>
                  <linearGradient
                    id={`${gradientId}-current`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    {/* A wash, not a block, fading out before the axis. */}
                    <stop
                      offset="0%"
                      stopColor="var(--color-current)"
                      stopOpacity={0.14}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-current)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
              ) : null}
              {axes}
              {isLine ? (
                <>
                  {/* Last year is a line with no fill. Two washes overlapping
                      for most of the year mixed into a third colour that
                      belonged to neither, and the eye read the overlap as a
                      region with a meaning of its own. This year keeps the
                      wash: it is the year the card is about. */}
                  {hasPrevious ? (
                    <Area
                      dataKey="previous"
                      stroke="var(--color-previous)"
                      fill="none"
                      type={CURVE}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      // Months are readings, not a continuous signal — the dot
                      // is where a number actually exists.
                      dot={dot("var(--color-previous)")}
                      activeDot={activeDot("var(--color-previous)")}
                      // An unreported month stays a gap in the line rather than
                      // being bridged over as though it had been filled in.
                      connectNulls={false}
                      animationDuration={DRAW_MS}
                      animationEasing="ease-out"
                    />
                  ) : null}
                  <Area
                    dataKey="current"
                    stroke="var(--color-current)"
                    fill={`url(#${gradientId}-current)`}
                    // Area multiplies its own fillOpacity into the gradient, and
                    // its default 0.6 washes the stops out to nothing. The
                    // gradient is the only thing setting opacity.
                    fillOpacity={1}
                    type={CURVE}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={dot("var(--color-current)")}
                    activeDot={activeDot("var(--color-current)")}
                    connectNulls={false}
                    animationDuration={DRAW_MS}
                    animationEasing="ease-out"
                    // A beat behind last year, so the two are read in the order
                    // the card states them: here is last year, and here is this
                    // year against it.
                    animationBegin={hasPrevious ? STAGGER_MS : 0}
                  />
                </>
              ) : (
                <>
                  {/* 24px rather than filling the slot. Across three reports on
                      a laptop the slot is several hundred pixels, and a bar that
                      wide is a block of colour that outweighs the figures it
                      stands for; the rest of the slot is air.

                      A fixed size, not maxBarSize: under a cap recharts still
                      centres each bar in its own half of the slot, so a pair
                      stood a hundred pixels apart and read as two unrelated
                      bars. A fixed size packs the pair together at the slot's
                      centre, 2px apart. */}
                  {hasPrevious ? (
                    <Bar
                      dataKey="previous"
                      fill="var(--color-previous)"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                      activeBar={{ fillOpacity: 0.82 }}
                      animationDuration={DRAW_MS}
                      animationEasing="ease-out"
                    >
                      <LabelList
                        content={
                          <PairLabel
                            rows={rows}
                            series="previous"
                            hasPrevious={hasPrevious}
                          />
                        }
                      />
                    </Bar>
                  ) : null}
                  <Bar
                    dataKey="current"
                    fill="var(--color-current)"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                    activeBar={{ fillOpacity: 0.82 }}
                    animationDuration={DRAW_MS}
                    animationEasing="ease-out"
                    animationBegin={hasPrevious ? STAGGER_MS : 0}
                  >
                    <LabelList
                      content={
                        <PairLabel
                          rows={rows}
                          series="current"
                          hasPrevious={hasPrevious}
                        />
                      }
                    />
                  </Bar>
                </>
              )}
            </Chart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The same chart, for the print document.
//
// Three things the screen version does are wrong on paper, and they are why
// this is a second component rather than another prop on the first:
//
//   Size. ChartContainer draws inside a ResponsiveContainer, which measures its
//   parent — and the print document is display:none until the print dialog
//   opens, so it measures nothing and the chart comes out empty. This one is
//   handed explicit pixels and never measures anything.
//
//   Colour. The series tokens resolve to the dark ramp under .dark, so a reader
//   with the app in dark mode would print a dark chart onto white paper. The
//   light values are written out here, the same rule the print table colours
//   follow.
//
//   Motion and hover. There is no cursor on paper. No animation, no tooltip.
// ---------------------------------------------------------------------------

const PRINT_CURRENT = "#a42a28"; /* --series-1, light */
const PRINT_PREVIOUS = "#2a78d6"; /* --series-4, light */
const PRINT_SURFACE = "#ffffff";

export function PrintYearCompareChart({
  rows,
  variant = "bar",
  width = 980,
  height = 230,
}: {
  rows: YearCompareRow[];
  variant?: "bar" | "line";
  width?: number;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const hasPrevious = rows.some(
    (row) => row.previous !== null && row.previous !== 0
  );
  const isLine = variant === "line";
  const Chart = isLine ? AreaChart : BarChart;

  const printDot = (color: string) => ({
    r: 3,
    fill: color,
    stroke: PRINT_SURFACE,
    strokeWidth: 1.5,
  });

  return (
    <Chart width={width} height={height} data={rows} barGap={2}>
      {isLine ? (
        <defs>
          {(
            [
              ["previous", PRINT_PREVIOUS],
              ["current", PRINT_CURRENT],
            ] as const
          ).map(([series, color]) => (
            <linearGradient
              key={series}
              id={`${gradientId}-${series}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>
      ) : null}
      <CartesianGrid vertical={false} stroke="#e7e3d8" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        interval={0}
        tick={{ fontSize: 10, fill: "#4f5556" }}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={62}
        tick={{ fontSize: 10, fill: "#4f5556" }}
        tickFormatter={(value: number) =>
          value === 0 ? "$0" : compact.format(value)
        }
      />
      {isLine ? (
        <>
          {hasPrevious ? (
            <Area
              dataKey="previous"
              stroke={PRINT_PREVIOUS}
              fill={`url(#${gradientId}-previous)`}
              fillOpacity={1}
              type={CURVE}
              strokeWidth={2}
              dot={printDot(PRINT_PREVIOUS)}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          <Area
            dataKey="current"
            stroke={PRINT_CURRENT}
            fill={`url(#${gradientId}-current)`}
            fillOpacity={1}
            type={CURVE}
            strokeWidth={2}
            dot={printDot(PRINT_CURRENT)}
            connectNulls={false}
            isAnimationActive={false}
          />
        </>
      ) : (
        <>
          {hasPrevious ? (
            <Bar
              dataKey="previous"
              fill={PRINT_PREVIOUS}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ) : null}
          <Bar
            dataKey="current"
            fill={PRINT_CURRENT}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </>
      )}
    </Chart>
  );
}

// The legend, as markup rather than recharts' own — ChartLegendContent reads
// the ChartContainer context this chart deliberately does without.
export function PrintChartLegend({
  currentYear,
  previousYear,
}: {
  currentYear: number;
  previousYear: number | null;
}) {
  return (
    <p className="print-chart-legend">
      <span style={{ color: PRINT_CURRENT }}>■</span> {currentYear}
      {previousYear === null ? null : (
        <>
          {"  "}
          <span style={{ color: PRINT_PREVIOUS }}>■</span> {previousYear}
        </>
      )}
    </p>
  );
}
