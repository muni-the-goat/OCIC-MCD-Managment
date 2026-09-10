// A monthly budget report is one month's actual spend, kept in that month's
// column — m01…m12 — with every other column zeroed on save. See budgetRows()
// in src/app/(app)/reports/actions.ts.
//
// That makes the month picker load-bearing in a way nothing on screen admitted.
// Changing it used to leave the figures behind in the old month's column: the
// form redrew the inputs against the new month, found it empty, and showed four
// blank boxes. Saving then wrote zero into the new month and zero over the old
// one, and the money was gone.
//
// It happened for real. A report titled "Digital — July 2026" had been filed
// under August; correcting the month to July blanked $506.68 of social spend,
// which had to be typed back in from the screenshot.
//
// So the figures move with the month. A swap rather than a one-way move,
// because a swap is its own undo: picking the wrong month and picking again
// puts everything back exactly, with no confirmation to read and nothing to
// regret.
export function swapMonthAmounts(
  amounts: string[],
  from: number,
  to: number
): string[] {
  if (from === to) return amounts;
  const fromIndex = from - 1;
  const toIndex = to - 1;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= amounts.length ||
    toIndex >= amounts.length
  ) {
    return amounts;
  }
  const next = [...amounts];
  next[toIndex] = amounts[fromIndex];
  next[fromIndex] = amounts[toIndex];
  return next;
}
