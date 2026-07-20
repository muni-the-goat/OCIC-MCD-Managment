import {
  MONTH_KEYS,
  MONTH_NAMES,
  MONTH_SHORT,
  QUARTERS,
  itemTotal,
  type BudgetPeriod,
  type BudgetItem,
} from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function fmt(n: number) {
  return n === 0 ? "—" : currency.format(n);
}

interface Section {
  name: string;
  items: BudgetItem[];
}

// Group flat rows into sections, preserving sort order.
function groupSections(items: BudgetItem[]): Section[] {
  const map = new Map<string, Section>();
  const order: string[] = [];
  for (const item of items) {
    const key = item.section ?? "";
    if (!map.has(key)) {
      map.set(key, { name: key, items: [] });
      order.push(key);
    }
    map.get(key)!.items.push(item);
  }
  return order.map((k) => map.get(k)!);
}

function monthSums(items: BudgetItem[]): number[] {
  return MONTH_KEYS.map((key) =>
    items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0)
  );
}

export function BudgetGrid({
  items,
  budgetPeriod = "annual",
  month = 1,
}: {
  items: BudgetItem[];
  budgetPeriod?: BudgetPeriod;
  month?: number;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items.</p>;
  }

  const sections = groupSections(items);
  const grandMonth = monthSums(items);
  const grandTotal = grandMonth.reduce((a, b) => a + b, 0);

  if (budgetPeriod === "monthly") {
    const monthIndex = Math.min(11, Math.max(0, month - 1));
    const monthKey = MONTH_KEYS[monthIndex];

    return (
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Actual expenses for {MONTH_NAMES[monthIndex]}, grouped by section
          </caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="p-3 text-left font-medium">Line item</th>
              <th className="p-3 text-right font-medium">
                {MONTH_NAMES[monthIndex]} actual amount
              </th>
            </tr>
          </thead>
          {sections.map((section, sectionIndex) => {
            const subtotal = section.items.reduce(
              (sum, item) => sum + Number(item[monthKey] ?? 0),
              0
            );
            return (
              <tbody key={sectionIndex}>
                <tr className="bg-muted/40">
                  <td colSpan={2} className="p-3 font-semibold">
                    {section.name || "Uncategorized"}
                  </td>
                </tr>
                {section.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3">{item.name || "—"}</td>
                    <td className="p-3 text-right tabular-nums">
                      {fmt(Number(item[monthKey] ?? 0))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/20 font-medium">
                  <td className="p-3">Subtotal</td>
                  <td className="p-3 text-right tabular-nums">
                    {fmt(subtotal)}
                  </td>
                </tr>
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t-2 bg-primary/5 font-semibold">
              <td className="p-3">Total</td>
              <td className="p-3 text-right tabular-nums">
                {fmt(grandMonth[monthIndex])}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Actual expenses by section and month, grouped by quarter
        </caption>
        <thead>
          {/* Quarter grouping row */}
          <tr className="border-b">
            <th className="sticky left-0 z-10 min-w-48 bg-card p-2 text-left" />
            {QUARTERS.map((q) => (
              <th
                key={q.label}
                colSpan={3}
                className="border-l p-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {q.label}
              </th>
            ))}
            <th className="border-l p-2" />
          </tr>
          <tr className="border-b text-muted-foreground">
            <th className="sticky left-0 z-10 min-w-48 bg-card p-2 text-left font-medium">
              Line item
            </th>
            {MONTH_SHORT.map((m, i) => (
              <th
                key={m}
                className={`min-w-20 p-2 text-right font-medium ${
                  i % 3 === 0 ? "border-l" : ""
                }`}
              >
                {m}
              </th>
            ))}
            <th className="min-w-24 border-l p-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        {sections.map((section, si) => {
            const sub = monthSums(section.items);
            const sectionTotal = sub.reduce((a, b) => a + b, 0);
            return (
              <tbody key={si}>
                <tr className="bg-muted/40">
                  <td
                    colSpan={14}
                    className="sticky left-0 p-2 text-sm font-semibold"
                  >
                    {section.name || "Uncategorized"}
                  </td>
                </tr>
                {section.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card p-2">
                      {item.name || "—"}
                    </td>
                    {MONTH_KEYS.map((key, i) => (
                      <td
                        key={key}
                        className={`p-2 text-right tabular-nums ${
                          i % 3 === 0 ? "border-l" : ""
                        }`}
                      >
                        {fmt(Number(item[key] ?? 0))}
                      </td>
                    ))}
                    <td className="border-l p-2 text-right font-medium tabular-nums">
                      {fmt(itemTotal(item))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/20 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/20 p-2">
                    Subtotal
                  </td>
                  {sub.map((t, i) => (
                    <td
                      key={i}
                      className={`p-2 text-right tabular-nums ${
                        i % 3 === 0 ? "border-l" : ""
                      }`}
                    >
                      {fmt(t)}
                    </td>
                  ))}
                  <td className="border-l p-2 text-right tabular-nums">
                    {fmt(sectionTotal)}
                  </td>
                </tr>
              </tbody>
            );
          })}
        <tfoot>
          <tr className="border-t-2 bg-primary/5 font-semibold">
            <td className="sticky left-0 z-10 bg-primary/5 p-2">Total</td>
            {grandMonth.map((t, i) => (
              <td
                key={i}
                className={`p-2 text-right tabular-nums ${
                  i % 3 === 0 ? "border-l" : ""
                }`}
              >
                {fmt(t)}
              </td>
            ))}
            <td className="border-l p-2 text-right tabular-nums">
              {fmt(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
