"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
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
  type: TaskType;
  month: number; // 1–12
}

// The month histogram is one series, so identity already lives in the axis and
// the colour stays recessive and on-brand — same treatment as the budget tab.
const SERIES = "var(--chart-1)";

const chartConfig = {
  tasks: { label: "Tasks", color: SERIES },
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
}

interface MonthRow {
  month: string;
  full: string;
  count: number;
}

function TaskTooltip({
  total,
  ...props
}: React.ComponentProps<typeof ChartTooltipContent> & { total: number }) {
  const row = props.payload?.[0]?.payload as
    | (Partial<SliceRow> & Partial<MonthRow>)
    | undefined;
  if (!row) return null;

  const value = Number(row.count ?? 0);
  // A month with no tasks would otherwise trail an empty "0 tasks" card across
  // the unfinished half of the year.
  if (!value && row.full) return null;

  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={() => row.label ?? row.full ?? ""}
      formatter={() => (
        <div className="flex flex-1 items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {row.label ? "Tasks" : "Logged"}
          </span>
          <span className="font-medium tabular-nums">
            {value}
            {row.label ? ` · ${share(value, total)}%` : ""}
          </span>
        </div>
      )}
    />
  );
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
  reportCount,
  year,
}: {
  entries: TaskEntry[];
  reportCount: number;
  year: number;
}) {
  const total = entries.length;

  // Built from TASK_TYPES rather than from the data, so a type always takes the
  // same colour slot and the ring never repaints when a type drops out.
  const slices: SliceRow[] = TASK_TYPES.map((type) => ({
    type: type.id,
    label: type.label,
    count: entries.filter((entry) => entry.type === type.id).length,
    fill: taskTypeColor(type.id),
  })).filter((slice) => slice.count > 0);

  const monthly: MonthRow[] = MONTH_SHORT.map((short, index) => ({
    month: short,
    full: MONTH_NAMES[index],
    count: entries.filter((entry) => entry.month === index + 1).length,
  }));

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {reportCount === 0
          ? "No reviewed monthly reports are available for this selection."
          : `${plural(reportCount, "reviewed monthly report")} in FY ${year}, but none of them list any tasks yet. Add tasks when writing a monthly report and they will be charted here.`}
      </p>
    );
  }

  const top = slices.reduce((best, slice) =>
    slice.count > best.count ? slice : best
  );
  const peak = monthly.reduce((best, entry) =>
    entry.count > best.count ? entry : best
  );
  const activeMonths = monthly.filter((entry) => entry.count > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
        <Stat
          hero
          label="Tasks completed"
          value={String(total)}
          caption={`Across ${plural(reportCount, "reviewed monthly report")} · FY ${year}`}
        />
        <Stat
          label="Most common"
          value={top.label}
          caption={`${plural(top.count, "task")} · ${share(top.count, total)}% of the year`}
        />
        <Stat
          label="Busiest month"
          value={peak.count > 0 ? peak.full : "—"}
          caption={
            peak.count > 0
              ? `${plural(peak.count, "task")} · ${share(peak.count, total)}% of the year`
              : "No tasks recorded"
          }
        />
        <Stat
          label="Activity"
          value={`${activeMonths} / 12`}
          caption={`Months with tasks · ${plural(slices.length, "task type")}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-label="Task mix by type"
          className="flex min-w-0 flex-col rounded-xl border p-4 lg:col-span-2"
        >
          <h4 className="font-label text-sm font-medium">Task mix</h4>
          <p className="text-xs text-muted-foreground">
            Every reviewed task, grouped by type.
          </p>
          {/* The ring reads part-to-whole at a glance; the list beside it carries
              every value in text, which is what keeps the lighter hues legible
              for readers who cannot separate them by colour.
              flex-1 + justify-center: this section is shorter than the month
              chart it sits beside, so the pair centres in the leftover height
              instead of stranding it all under the legend. */}
          {/* Stacked at every width rather than ring-beside-list: this section is
              two of five columns, so a side-by-side legend would be ~130px wide
              and truncate "Content & design" — and a task type that reads
              "Conte…" has lost the identity the colour was there to support. */}
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
            {/* Capped and centred so the list still reads as the ring's readout
                in the wider layouts, where this section spans the whole card. */}
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
          aria-label="Tasks by month"
          // min-w-0: a grid item's default min-width:auto would let the chart's
          // floor width widen the column, and the page with it.
          className="min-w-0 rounded-xl border p-4 lg:col-span-3"
        >
          <h4 className="font-label text-sm font-medium">Tasks by month</h4>
          <p className="text-xs text-muted-foreground">
            How the workload was spread across the year.
          </p>
          {/* Twelve labels do not fit a phone, and thinning them hides half the
              year — the plot keeps a floor width and scrolls inside this box. */}
          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-64 w-full min-w-[480px]"
            >
              <BarChart
                accessibilityLayer
                data={monthly}
                margin={{ top: 20, right: 12, left: 12, bottom: 0 }}
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
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  isAnimationActive={false}
                  content={<TaskTooltip total={total} />}
                />
                <Bar
                  dataKey="count"
                  fill={SERIES}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                >
                  {/* Only the busiest month is direct-labelled; the axis and the
                      tooltip carry the rest. */}
                  <LabelList
                    dataKey="count"
                    position="top"
                    offset={8}
                    className="fill-foreground tabular-nums"
                    fontSize={11}
                    formatter={(value) =>
                      Number(value) > 0 && Number(value) === peak.count
                        ? String(value)
                        : ""
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </section>
      </div>

      {/* Table twin: every plotted value stays reachable without colour or hover.
          sr-only lives on the wrapping div, not the table — `overflow: hidden`
          does not contain a display:table box, so the columns would widen the
          document and give the page a horizontal scrollbar on a phone. */}
      <div className="sr-only">
        <table>
          <caption>
            Reviewed monthly-report tasks by type and month, FY {year}
          </caption>
          <thead>
            <tr>
              <th scope="col">Task type</th>
              {MONTH_NAMES.map((name) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.type}>
                <th scope="row">{slice.label}</th>
                {MONTH_NAMES.map((name, index) => (
                  <td key={name}>
                    {
                      entries.filter(
                        (entry) =>
                          entry.type === slice.type && entry.month === index + 1
                      ).length
                    }
                  </td>
                ))}
                <td>{slice.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {monthly.map((entry) => (
                <td key={entry.month}>{entry.count}</td>
              ))}
              <td>{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
