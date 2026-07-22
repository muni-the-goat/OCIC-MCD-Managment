"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  MONTH_NAMES,
  TASK_TYPES,
  taskTypeColor,
  type TaskType,
} from "@/lib/types";

export interface TaskEntry {
  name: string;
  type: TaskType;
}

const chartConfig = {
  count: { label: "Tasks" },
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
  month,
  year,
}: {
  entries: TaskEntry[];
  reportCount: number;
  month: number;
  year: number;
}) {
  const total = entries.length;
  const period = `${MONTH_NAMES[month - 1]} ${year}`;

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
          caption={`Across ${plural(reportCount, "reviewed report")} · ${period}`}
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
    </div>
  );
}
