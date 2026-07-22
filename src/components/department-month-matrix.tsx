import type { DepartmentRecord } from "@/lib/departments";
import {
  MONTH_KEYS,
  MONTH_NAMES,
  type Department,
  type MonthlyAmounts,
} from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function fmt(n: number) {
  return n === 0 ? "—" : currency.format(n);
}

const UNASSIGNED = "unassigned";
type ColumnId = Department | typeof UNASSIGNED;

export interface DepartmentMatrixItem extends MonthlyAmounts {
  // Resolved from the report author's profile. Null when that author has no
  // department — those rows get their own column rather than being dropped,
  // because a column set that does not add up to the Total is a table that lies.
  department: Department | null;
}

// A lookup table, deliberately not a chart. The question it answers is "what did
// Multimedia spend in April" — you read one cell — and no chart form answers a
// cell lookup better than a cell does. The month shape and the section ranking
// are already charted directly below it.
export function DepartmentMonthMatrix({
  items,
  departments,
  year,
}: {
  items: DepartmentMatrixItem[];
  // Passed in rather than imported: departments are rows now, and the column
  // order is theirs.
  departments: DepartmentRecord[];
  year: number;
}) {
  // columnId -> twelve monthly sums. Amounts already live in m01–m12, so the
  // month split falls out of the columns rather than out of the report period.
  const grid = new Map<ColumnId, number[]>();
  for (const item of items) {
    const columnId: ColumnId = item.department ?? UNASSIGNED;
    let column = grid.get(columnId);
    if (!column) {
      column = new Array<number>(12).fill(0);
      grid.set(columnId, column);
    }
    MONTH_KEYS.forEach((key, index) => {
      column[index] += Number(item[key] ?? 0);
    });
  }

  const hasSpend = (id: ColumnId) =>
    grid.get(id)?.some((value) => value !== 0) ?? false;

  // Column order follows the departments table's own sort order so it never
  // reshuffles between years or between filter states, with Unassigned last. A
  // department with nothing in it is dropped: an all-zero column is a wider
  // table that says nothing. Empty month rows are kept, though — the shape of
  // the year is the point, and a missing row would hide the fact that nothing
  // was reported.
  const columns = [
    ...departments
      .filter((department) => hasSpend(department.id))
      .map((department) => ({
        id: department.id as ColumnId,
        label: department.label,
        short: department.short,
      })),
    ...(hasSpend(UNASSIGNED)
      ? [
          {
            id: UNASSIGNED as ColumnId,
            label: "Unassigned",
            short: "Unassigned",
          },
        ]
      : []),
  ];

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No reviewed spend to break down by department for FY {year}.
      </p>
    );
  }

  const monthTotals = Array.from({ length: 12 }, (_, index) =>
    columns.reduce((sum, column) => sum + (grid.get(column.id)?.[index] ?? 0), 0)
  );
  const columnTotals = columns.map((column) =>
    (grid.get(column.id) ?? []).reduce((sum, value) => sum + value, 0)
  );
  const grandTotal = monthTotals.reduce((sum, value) => sum + value, 0);

  // With a single department its column and the Total column would be identical
  // down the whole table, which reads as a rendering fault rather than a total.
  const showTotal = columns.length > 1;

  const now = new Date();
  const currentMonth = year === now.getFullYear() ? now.getMonth() : -1;

  const share = (value: number) =>
    grandTotal > 0 && value !== 0
      ? `${((value / grandTotal) * 100).toFixed(2)}%`
      : "—";

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Reviewed spend for FY {year}, by department and month, with a monthly
          total and each month&apos;s share of the year.
        </caption>
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-28 bg-muted/40 p-2 text-left font-medium"
            >
              Month
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                title={column.label}
                className="min-w-24 border-l p-2 text-right font-medium"
              >
                {column.short}
              </th>
            ))}
            {showTotal ? (
              <th
                scope="col"
                className="min-w-28 border-l p-2 text-right font-medium text-foreground"
              >
                Total
              </th>
            ) : null}
            <th
              scope="col"
              className="min-w-20 border-l p-2 text-right font-medium"
            >
              % of year
            </th>
          </tr>
        </thead>
        <tbody>
          {MONTH_NAMES.map((monthName, index) => {
            const isCurrent = index === currentMonth;
            // Ivory rather than a red tint: the Total row below already owns the
            // brand red, and two red rows in one table are two things that look
            // like the same thing.
            const rowTint = isCurrent ? "bg-secondary" : "";
            return (
              <tr
                key={monthName}
                aria-current={isCurrent ? "true" : undefined}
                className={`border-b last:border-0 ${rowTint} ${
                  isCurrent ? "font-medium" : ""
                }`}
              >
                <th
                  scope="row"
                  className={`sticky left-0 z-10 p-2 text-left font-normal ${
                    isCurrent ? "bg-secondary font-medium" : "bg-card"
                  }`}
                >
                  {monthName}
                  {isCurrent ? (
                    <span className="sr-only"> (current month)</span>
                  ) : null}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className="border-l p-2 text-right tabular-nums"
                  >
                    {fmt(grid.get(column.id)?.[index] ?? 0)}
                  </td>
                ))}
                {showTotal ? (
                  <td className="border-l p-2 text-right font-medium tabular-nums">
                    {fmt(monthTotals[index])}
                  </td>
                ) : null}
                <td className="border-l p-2 text-right tabular-nums text-muted-foreground">
                  {share(monthTotals[index])}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-primary/5 font-semibold">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-primary/5 p-2 text-left"
            >
              Total
            </th>
            {columnTotals.map((total, index) => (
              <td
                key={columns[index].id}
                className="border-l p-2 text-right tabular-nums"
              >
                {fmt(total)}
              </td>
            ))}
            {showTotal ? (
              <td className="border-l p-2 text-right tabular-nums">
                {fmt(grandTotal)}
              </td>
            ) : null}
            <td className="border-l p-2 text-right tabular-nums">
              {grandTotal > 0 ? "100.00%" : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
