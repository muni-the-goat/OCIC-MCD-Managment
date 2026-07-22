"use client";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  TASK_TYPES,
  taskTypeColor,
  type TaskType,
} from "@/lib/types";

export interface TaskEntry {
  name: string;
  type: TaskType;
}

// The trend is one series, so identity already lives in the axis and the colour
// stays recessive and on-brand — same treatment as the budget tab's bars.
const SERIES = "var(--chart-1)";

const chartConfig = {
  count: { label: "Tasks", color: SERIES },
} satisfies ChartConfig;

function share(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

interface SliceRow {
  type: TaskType;
  label: string;
  count: number;
  fill: string;
  tasks: string[];
}

interface TrendRow {
  month: string;
  full: string;
  count: number | null;
}

function TaskTooltip({
  total,
  ...props
}: React.ComponentProps<typeof ChartTooltipContent> & { total: number }) {
  const row = props.payload?.[0]?.payload as SliceRow | undefined;
  if (!row) return null;

  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={() => row.label}
      formatter={() => (
        <div className="flex flex-1 items-center justify-between gap-4">
          <span className="text-muted-foreground">Tasks</span>
          <span className="font-medium tabular-nums">
            {row.count} · {share(row.count, total)}%
          </span>
        </div>
      )}
    />
  );
}

function TrendTooltip(
  props: React.ComponentProps<typeof ChartTooltipContent>
) {
  const row = props.payload?.[0]?.payload as TrendRow | undefined;
  if (!row) return null;

  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={() => row.full}
      formatter={() => (
        <div className="flex flex-1 items-center justify-between gap-4">
          {row.count === null ? (
            <span className="text-muted-foreground">No reviewed report</span>
          ) : (
            <>
              <span className="text-muted-foreground">Tasks</span>
              <span className="font-medium tabular-nums">{row.count}</span>
            </>
          )}
        </div>
      )}
    />
  );
}

// The comparison the reader actually wants from a month-scoped card: is this
// month normal? Rendered in muted ink with an arrow rather than in green or
// red — more tasks is not self-evidently better, and status colours would
// assert a judgement the data does not carry.
function delta(current: number, previous: number | null | undefined, previousLabel: string) {
  if (previous === null || previous === undefined) return null;
  const change = current - previous;
  if (change === 0) return `Level with ${previousLabel}`;
  return `${change > 0 ? "↑" : "↓"} ${Math.abs(change)} vs ${previousLabel}`;
}

// The ring's own readout. Deliberately a step below the "Tasks completed" tile
// above it — the same figure, but the stat row keeps the view's single hero.
function Total({ value }: { value: number }) {
  return (
    <>
      <span className="font-heading text-3xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="font-label text-xs text-muted-foreground">
        {value === 1 ? "task" : "tasks"}
      </span>
    </>
  );
}

function Stat({
  label,
  value,
  caption,
  hero = false,
}: {
  label: string;
  value: string;
  caption: string;
  hero?: boolean;
}) {
  return (
    <div className="min-w-0 lg:px-5 lg:first:pl-0">
      <p className="font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-heading font-semibold ${
          hero ? "text-3xl sm:text-4xl" : "text-xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-balance text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

export function MonthlyTaskCharts({
  entries,
  trend,
  reportCount,
  month,
  year,
}: {
  entries: TaskEntry[];
  // Twelve slots, Jan–Dec. `null` means no reviewed report for that month, and
  // is drawn as a gap rather than as zero.
  trend: (number | null)[];
  reportCount: number;
  month: number;
  year: number;
}) {
  const total = entries.length;
  const period = `${MONTH_NAMES[month - 1]} ${year}`;

  const trendRows: TrendRow[] = MONTH_SHORT.map((short, index) => ({
    month: short,
    full: `${MONTH_NAMES[index]} ${year}`,
    count: trend[index] ?? null,
  }));
  const monthsWithData = trendRows.filter((row) => row.count !== null).length;
  const previousLabel = MONTH_NAMES[month - 2] ?? "December";
  const change = delta(total, month > 1 ? trend[month - 2] : null, previousLabel);

  // Built from TASK_TYPES rather than from the data, so a type always takes the
  // same colour slot and the ring never repaints when a type drops out.
  const slices: SliceRow[] = TASK_TYPES.map((type) => ({
    type: type.id,
    label: type.label,
    count: entries.filter((entry) => entry.type === type.id).length,
    fill: taskTypeColor(type.id),
    tasks: entries
      .filter((entry) => entry.type === type.id)
      .map((entry) => entry.name),
  })).filter((slice) => slice.count > 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {reportCount === 0
          ? `No reviewed monthly reports are available for ${period}.`
          : `${plural(reportCount, "reviewed monthly report")} for ${period}, but neither lists any tasks yet. Add tasks when writing a monthly report and they will be charted here.`}
      </p>
    );
  }

  const top = slices.reduce((best, slice) =>
    slice.count > best.count ? slice : best
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border">
        <Stat
          hero
          label="Tasks completed"
          value={String(total)}
          caption={
            change
              ? `${change} · across ${plural(reportCount, "reviewed report")}`
              : `Across ${plural(reportCount, "reviewed report")} · ${period}`
          }
        />
        <Stat
          label="Most common"
          value={top.label}
          caption={`${plural(top.count, "task")} · ${share(top.count, total)}% of the month`}
        />
        <Stat
          label="Kinds of work"
          value={`${slices.length} / ${TASK_TYPES.length}`}
          caption={`Task types used this month`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-label="Task mix by type"
          className="flex min-w-0 flex-col rounded-xl border p-4 lg:col-span-2"
        >
          <h4 className="font-label text-sm font-medium">Task mix</h4>
          <p className="text-xs text-muted-foreground">
            Every reviewed task this month, grouped by type.
          </p>
          {/* The ring reads part-to-whole at a glance; the list under it carries
              every value in text, which is what keeps the lighter hues legible
              for readers who cannot separate them by colour. Stacked rather
              than side by side: at two of five columns a horizontal legend
              would truncate "Content & design", and a type reading "Conte…"
              has lost the identity the colour was there to support. */}
          <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-4">
            {/* A ring drawn from a single slice is a 100% circle: it says nothing
                the count inside it does not. One type therefore gets the figure
                alone; the ring comes back the moment there is a mix to read. */}
            {slices.length > 1 ? (
              <div className="relative shrink-0">
                <ChartContainer
                  config={chartConfig}
                  className="aspect-square h-44 w-44"
                >
                  <PieChart margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
                    <ChartTooltip
                      isAnimationActive={false}
                      content={<TaskTooltip total={total} />}
                    />
                    <Pie
                      data={slices}
                      dataKey="count"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="100%"
                      // A real gap in the surface separates the arcs; a stroke
                      // around each one would add ink that is not data.
                      paddingAngle={1.5}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {slices.map((slice) => (
                        <Cell key={slice.type} fill={slice.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* The total sits in the hole rather than in an SVG <text> node
                    so it inherits the page's type scale and stays crisp. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <Total value={total} />
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 flex-col items-center px-6 py-4">
                <Total value={total} />
              </div>
            )}
            {/* Real text, not an sr-only twin: every plotted value is reachable
                here without colour or hover, so a hidden table would only make
                a screen reader read the same figures twice. */}
            <ul className="w-full min-w-0 max-w-sm space-y-2">
              {slices.map((slice) => (
                <li
                  key={slice.type}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.fill }}
                    />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {slice.count}
                    </span>{" "}
                    · {share(slice.count, total)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-label="Tasks completed this month"
          className="flex min-w-0 flex-col rounded-xl border p-4 lg:col-span-3"
        >
          <h4 className="font-label text-sm font-medium">What was done</h4>
          <p className="text-xs text-muted-foreground">
            The tasks behind the chart, grouped by type.
          </p>
          {/* Scrolls rather than grows: a busy month can carry thirty tasks and
              this card must stay a fixed size as more charts join it. flex-1 +
              min-h-0 makes it take exactly the height the ring beside it sets,
              so the list ends at the card's edge instead of at an arbitrary
              cap with dead space under it. */}
          <div className="mt-4 min-h-40 flex-1 space-y-4 overflow-y-auto pr-1">
            {slices.map((slice) => (
              <div key={slice.type}>
                <p className="flex items-center gap-2 font-label text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                  />
                  {slice.label}
                  <span className="tabular-nums">· {slice.count}</span>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {slice.tasks.map((task, index) => (
                    <li
                      key={`${slice.type}-${index}`}
                      className="text-sm text-balance"
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Year-long context under the month-scoped detail above. This is not the
          old Jan–Dec bar chart returning as the card's subject: the question it
          answers is "is the month I am looking at a normal one", which is why
          the selected month is marked on it and why it sits last. A line rather
          than bars because the shape of the year is the point — bars would
          invite comparing individual months, which the tooltip already does.
          Below two months of data there is no shape to read, so the section
          says so in words rather than drawing a lone dot in an empty frame and
          leaving the reader to work out why nothing is there. */}
      <section
        aria-label="Task volume across the year"
        className="min-w-0 rounded-xl border p-4"
      >
        <h4 className="font-label text-sm font-medium">Activity trend</h4>
        <p className="text-xs text-muted-foreground">
          {monthsWithData > 1
            ? `Tasks per month across ${year}, with ${MONTH_NAMES[month - 1]} marked. Months without a reviewed report are left as gaps, not as zero.`
            : `Tasks per month across ${year}.`}
        </p>
        {monthsWithData > 1 ? (
          <>
          {/* Twelve labels do not fit a phone and thinning them hides half the
              year, so the plot keeps a floor width and scrolls inside this box
              instead of widening the page. */}
          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-48 w-full min-w-[480px]"
            >
              <LineChart
                accessibilityLayer
                data={trendRows}
                margin={{ top: 20, right: 16, left: 12, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={32}
                  allowDecimals={false}
                  className="text-xs tabular-nums"
                />
                <ChartTooltip
                  isAnimationActive={false}
                  content={<TrendTooltip />}
                />
                <Line
                  dataKey="count"
                  // Straight segments, not a spline: these are twelve discrete
                  // monthly totals, and a curve would draw values for points in
                  // between that were never measured.
                  type="linear"
                  stroke={SERIES}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // A month with no report is a gap in the line, not a dip to
                  // zero through it.
                  connectNulls={false}
                  dot={{
                    r: 4,
                    fill: SERIES,
                    // 2px surface ring so the markers stay legible where they
                    // sit close together or cross the line.
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {/* Marks the month the rest of the card is about. Carries no
                    text label: the axis tick directly beneath it already reads
                    "Apr", and the value is the hero figure at the top of the
                    card, so a label here would be the third printing of a
                    number the reader has already been given twice. */}
                {trend[month - 1] !== null && trend[month - 1] !== undefined ? (
                  <ReferenceDot
                    x={MONTH_SHORT[month - 1]}
                    y={trend[month - 1] as number}
                    r={7}
                    fill={SERIES}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ) : null}
              </LineChart>
            </ChartContainer>
          </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            A trend needs at least two months with reviewed reports.{" "}
            {monthsWithData === 1
              ? `${MONTH_NAMES[month - 1]} is the only one in ${year} so far.`
              : `None have been reviewed for ${year} yet.`}{" "}
            The line appears here once a second month is reviewed.
          </p>
        )}
      </section>
    </div>
  );
}
