"use client";

import {
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
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  MONTH_SHORT,
  itemTotal,
  type BudgetItem,
} from "@/lib/types";

// Each chart here carries a single series, so colour is not encoding anything
// inside a chart — it identifies the chart. Two cards side by side in the same
// red read as one continued series, so they take separate slots from the shared
// categorical palette (see globals.css).
//
// Slot 1, brand red, clears 3:1 on both card surfaces and leads the budget card.
const MONTH_SERIES = "var(--series-1)";
// Slot 2, gold, sits at 2.17:1 on white. Legal here and only here, because this
// chart prints a value on every bar — remove those labels and this must change.
const ITEM_SERIES = "var(--series-2)";

// Past eight bars the ranking stops being scannable; the tail folds into one row.
const MAX_RANKED = 8;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const chartConfig = {
  amount: { label: "Spend", color: MONTH_SERIES },
} satisfies ChartConfig;

// Cents stop earning their width once a total runs six figures, and the hero
// figure is the one number that must not truncate on a phone.
const heroMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function heroValue(value: number) {
  return value >= 100000 ? heroMoney.format(value) : currency.format(value);
}

function share(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function truncate(value: string, max = 13) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface SpendRow {
  full?: string;
  name?: string;
  section?: string;
  amount?: number;
}

// Recharts clones this into `active`/`payload` props. Rendering nothing for an
// empty month keeps a "$0.00" card from following the cursor across the ten
// months of a part-finished year.
function SpendTooltip({
  hideZero,
  ...props
}: React.ComponentProps<typeof ChartTooltipContent> & { hideZero?: boolean }) {
  const row = props.payload?.[0]?.payload as SpendRow | undefined;
  if (!row || (hideZero && !Number(row.amount))) return null;

  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={() =>
        row.section ? `${row.section} · ${row.name}` : (row.full ?? "")
      }
      formatter={(value) => (
        <div className="flex flex-1 items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {row.section ? "Total" : "Spend"}
          </span>
          <span className="font-medium tabular-nums">
            {currency.format(Number(value))}
          </span>
        </div>
      )}
    />
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
      {/* Wraps rather than truncates: at two-up on a phone these captions are
          the only place the supporting figure appears. */}
      <p className="mt-0.5 text-xs text-balance text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

export function AnnualBudgetCharts({
  items,
  year,
}: {
  items: BudgetItem[];
  year: number;
}) {
  const monthly = MONTH_KEYS.map((key, index) => ({
    month: MONTH_SHORT[index],
    full: MONTH_NAMES[index],
    amount: items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0),
  }));
  const total = monthly.reduce((sum, entry) => sum + entry.amount, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Reviewed reports exist for this selection, but every line item is zero.
      </p>
    );
  }

  const peak = monthly.reduce((best, entry) =>
    entry.amount > best.amount ? entry : best
  );
  const activeMonths = monthly.filter((entry) => entry.amount > 0).length;

  // Section subtotals, largest first — the part-to-whole read.
  const sectionTotals = new Map<string, number>();
  for (const item of items) {
    const name = item.section || "Uncategorized";
    sectionTotals.set(name, (sectionTotals.get(name) ?? 0) + itemTotal(item));
  }
  const sections = [...sectionTotals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .filter((section) => section.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const spending = items
    .map((item) => ({
      key: item.id,
      name: item.name || "Untitled",
      section: item.section || "Uncategorized",
      amount: itemTotal(item),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const ranked =
    spending.length > MAX_RANKED
      ? [
          ...spending.slice(0, MAX_RANKED - 1),
          {
            key: "other",
            name: `Other (${spending.length - MAX_RANKED + 1})`,
            section: "Combined remainder",
            amount: spending
              .slice(MAX_RANKED - 1)
              .reduce((sum, item) => sum + item.amount, 0),
          },
        ]
      : spending;

  return (
    <div className="space-y-4">
      {/* Dividers only once the row is a single line; wrapped columns would
          otherwise carry a stray rule down their left edge. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
        <Stat
          hero
          label="Total spend"
          value={heroValue(total)}
          caption={`Reviewed expenses · FY ${year}`}
        />
        <Stat
          label="Peak month"
          value={peak.amount > 0 ? peak.full : "—"}
          caption={
            peak.amount > 0
              ? `${currency.format(peak.amount)} · ${share(peak.amount, total)}% of the year`
              : "No spend recorded"
          }
        />
        <Stat
          label="Top section"
          value={sections[0] ? sections[0].name : "—"}
          caption={
            sections[0]
              ? `${currency.format(sections[0].amount)} · ${share(sections[0].amount, total)}% of the year`
              : "No sections with spend"
          }
        />
        <Stat
          label="Activity"
          value={`${activeMonths} / 12`}
          caption={`Months with spend · ${spending.length} line items`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-label="Spend by month"
          // min-w-0: a grid item defaults to min-width:auto, which would let the
          // chart's floor width widen the whole column (and the page) instead of
          // being clamped so the inner box scrolls.
          className="min-w-0 rounded-xl border p-4 lg:col-span-3"
        >
          <h4 className="font-label text-sm font-medium">Spend by month</h4>
          <p className="text-xs text-muted-foreground">
            Every reviewed line item, summed per month.
          </p>
          {/* A phone cannot fit twelve month labels, and dropping every other
              one hides half the year. The plot keeps a floor width and scrolls
              inside this box instead, so all twelve months stay readable
              without the page itself ever scrolling sideways. */}
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
                  // The floor width guarantees room for all twelve, so render
                  // every tick rather than letting recharts thin them.
                  interval={0}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={60}
                  className="text-xs tabular-nums"
                  tickFormatter={(value: number) =>
                    value === 0 ? "$0" : compact.format(value)
                  }
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  isAnimationActive={false}
                  content={<SpendTooltip hideZero />}
                />
                <Bar
                  dataKey="amount"
                  fill={MONTH_SERIES}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                >
                  {/* Only the peak is direct-labelled; the axis and tooltip carry the rest. */}
                  <LabelList
                    dataKey="amount"
                    position="top"
                    offset={8}
                    className="fill-foreground tabular-nums"
                    fontSize={11}
                    formatter={(value) =>
                      Number(value) > 0 && Number(value) === peak.amount
                        ? currency.format(Number(value))
                        : ""
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </section>

        <section
          aria-label="Spend by line item"
          className="min-w-0 rounded-xl border p-4 lg:col-span-2"
        >
          <h4 className="font-label text-sm font-medium">Biggest line items</h4>
          <p className="text-xs text-muted-foreground">
            Full-year totals, largest first.
          </p>
          <ChartContainer
            config={chartConfig}
            className="mt-4 aspect-auto w-full"
            style={{ height: Math.max(160, ranked.length * 34 + 16) }}
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={ranked}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              {/* Headroom past the largest bar so its right-hand value label has
                  somewhere to sit instead of running off the card. */}
              <XAxis
                type="number"
                hide
                domain={[0, (dataMax: number) => dataMax * 1.32]}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                width={104}
                className="text-xs"
                tickFormatter={(value: string) => truncate(value)}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                isAnimationActive={false}
                content={<SpendTooltip />}
              />
              <Bar
                dataKey="amount"
                fill={ITEM_SERIES}
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="amount"
                  position="right"
                  offset={8}
                  className="fill-foreground tabular-nums"
                  fontSize={11}
                  formatter={(value) => compact.format(Number(value))}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </section>
      </div>

      {/* sections[0] is the "Top section" stat above, so the first row here
          always repeats it. Past one section the rows that follow carry the
          part-to-whole read and earn that repeat; at one section the repeat is
          the entire strip, so it is dropped rather than printed twice. The
          missing strip on a single-section card is this rule, not a fault. */}
      {sections.length > 1 ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs">
          {sections.map((section) => (
            <li key={section.name} className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {section.name}
              </span>{" "}
              {currency.format(section.amount)} ·{" "}
              {share(section.amount, total)}%
            </li>
          ))}
        </ul>
      ) : null}

      {/* Table twin: every plotted value stays reachable without colour or hover.
          sr-only lives on a wrapping div, not the table — `overflow: hidden` does
          not contain a display:table box, so the fourteen columns would widen the
          document and give the whole page a horizontal scrollbar on a phone. */}
      <div className="sr-only">
      <table>
        <caption>
          Reviewed expenses by line item and month, FY {year}
        </caption>
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">Line item</th>
            {MONTH_NAMES.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.section || "Uncategorized"}</td>
              <td>{item.name || "Untitled"}</td>
              {MONTH_KEYS.map((key) => (
                <td key={key}>{currency.format(Number(item[key] ?? 0))}</td>
              ))}
              <td>{currency.format(itemTotal(item))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total
            </th>
            {monthly.map((entry) => (
              <td key={entry.month}>{currency.format(entry.amount)}</td>
            ))}
            <td>{currency.format(total)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}
