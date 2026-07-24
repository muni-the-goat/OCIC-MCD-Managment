import { OcicLogo } from "@/components/ocic-logo";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  QUARTERS,
  itemTotal,
  reportPeriodLabel,
  type BudgetItem,
  type Report,
} from "@/lib/types";

// The letterhead layout that ends up in the print-to-PDF file. Rendered on the
// report detail page but display:none on screen — `@media print` in globals.css
// hides the app shell and reveals only this region. Kept separate from the
// on-screen BudgetGrid because the printed document has its own shape: a
// Name/Department/Date header block and a red "% of total" share column that the
// interactive grid does not carry.

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function money(n: number) {
  return currency.format(n);
}

// Each line's share of the report total, matching the sample's red italic column.
// Empty when there is no spend to divide by, so a report of zeros prints blanks
// rather than "NaN%".
function share(part: number, whole: number) {
  if (whole <= 0) return "";
  return (part / whole).toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
  });
}

interface Section {
  name: string;
  items: BudgetItem[];
}

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

export function PrintableBudgetReport({
  report,
  items,
  authorName,
  departmentName,
}: {
  report: Report;
  items: BudgetItem[];
  authorName: string;
  departmentName: string;
}) {
  const sections = groupSections(items);
  const isMonthly = report.budget_period === "monthly";
  const periodLabel = reportPeriodLabel(
    report.type,
    report.period_month,
    report.period_year,
    report.budget_period
  );

  const monthIndex = isMonthly
    ? Math.min(11, Math.max(0, (report.period_month ?? 1) - 1))
    : 0;
  const monthKey = MONTH_KEYS[monthIndex];

  // The report grand total is the denominator for every share, so it is computed
  // the same way the on-screen grid does: a monthly report on its one month, a
  // legacy annual report across all twelve.
  const itemValue = (item: BudgetItem) =>
    isMonthly ? Number(item[monthKey] ?? 0) : itemTotal(item);
  const grandTotal = items.reduce((sum, item) => sum + itemValue(item), 0);

  return (
    <div className="print-only" aria-hidden="true">
      <div className="print-doc">
        <header className="print-letterhead">
          <OcicLogo width={150} height={64} priority className="print-logo" />
          <div className="print-title-block">
            <h1 className="print-title">{report.title}</h1>
            <p className="print-subtitle">Budget report</p>
          </div>
        </header>

        <dl className="print-meta">
          <div>
            <dt>Name</dt>
            <dd>{authorName}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{departmentName}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{periodLabel}</dd>
          </div>
        </dl>

        <h2 className="print-summary-title">Summary</h2>

        {items.length === 0 ? (
          <p className="print-empty">No line items.</p>
        ) : isMonthly ? (
          <table className="print-table">
            <thead>
              <tr>
                <th className="pt-item">Line item</th>
                <th className="pt-num">{MONTH_NAMES[monthIndex]}</th>
                <th className="pt-pct">% of total</th>
              </tr>
            </thead>
            {sections.map((section, si) => {
              const subtotal = section.items.reduce(
                (sum, item) => sum + Number(item[monthKey] ?? 0),
                0
              );
              return (
                <tbody key={si}>
                  <tr className="pt-section">
                    <td colSpan={3}>{section.name || "Uncategorized"}</td>
                  </tr>
                  {section.items.map((item) => {
                    const value = Number(item[monthKey] ?? 0);
                    return (
                      <tr key={item.id}>
                        <td>{item.name || "—"}</td>
                        <td className="pt-num">{money(value)}</td>
                        <td className="pt-pct">{share(value, grandTotal)}</td>
                      </tr>
                    );
                  })}
                  <tr className="pt-subtotal">
                    <td>Subtotal</td>
                    <td className="pt-num">{money(subtotal)}</td>
                    <td className="pt-pct">{share(subtotal, grandTotal)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="pt-total">
                <td>Total</td>
                <td className="pt-num">{money(grandTotal)}</td>
                <td className="pt-pct" />
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th className="pt-item">Line item</th>
                {QUARTERS.map((q) => (
                  <th key={q.label} className="pt-num">
                    {q.label}
                  </th>
                ))}
                <th className="pt-num">Total</th>
                <th className="pt-pct">% of total</th>
              </tr>
            </thead>
            {sections.map((section, si) => {
              const quarterSum = (qMonths: readonly number[]) =>
                section.items.reduce(
                  (sum, item) =>
                    sum +
                    qMonths.reduce(
                      (qs: number, m) => qs + Number(item[MONTH_KEYS[m]] ?? 0),
                      0
                    ),
                  0
                );
              const sectionTotal = section.items.reduce(
                (sum, item) => sum + itemTotal(item),
                0
              );
              return (
                <tbody key={si}>
                  <tr className="pt-section">
                    <td colSpan={QUARTERS.length + 3}>
                      {section.name || "Uncategorized"}
                    </td>
                  </tr>
                  {section.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name || "—"}</td>
                      {QUARTERS.map((q) => (
                        <td key={q.label} className="pt-num">
                          {money(
                            q.months.reduce(
                              (qs: number, m) => qs + Number(item[MONTH_KEYS[m]] ?? 0),
                              0
                            )
                          )}
                        </td>
                      ))}
                      <td className="pt-num">{money(itemTotal(item))}</td>
                      <td className="pt-pct">
                        {share(itemTotal(item), grandTotal)}
                      </td>
                    </tr>
                  ))}
                  <tr className="pt-subtotal">
                    <td>Subtotal</td>
                    {QUARTERS.map((q) => (
                      <td key={q.label} className="pt-num">
                        {money(quarterSum(q.months))}
                      </td>
                    ))}
                    <td className="pt-num">{money(sectionTotal)}</td>
                    <td className="pt-pct">{share(sectionTotal, grandTotal)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tfoot>
              <tr className="pt-total">
                <td>Total</td>
                {QUARTERS.map((q) => (
                  <td key={q.label} className="pt-num">
                    {money(
                      items.reduce(
                        (sum, item) =>
                          sum +
                          q.months.reduce(
                            (qs: number, m) => qs + Number(item[MONTH_KEYS[m]] ?? 0),
                            0
                          ),
                        0
                      )
                    )}
                  </td>
                ))}
                <td className="pt-num">{money(grandTotal)}</td>
                <td className="pt-pct" />
              </tr>
            </tfoot>
          </table>
        )}

        <p className="print-footer">
          {report.status === "reviewed"
            ? "Reviewed report"
            : `Status: ${report.status}`}
          {" · MCD Management"}
        </p>
      </div>
    </div>
  );
}
