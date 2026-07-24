# MCD Management — Build Progress & Handoff Notes

## Current status

The main reporting workflow is implemented, production-build verified, and pushed to GitHub `main`. Vercel is connected to the repository for automatic deployments.

The monthly report tab, the office-domain sign-in restriction, and departments were developed on `feat/monthly-report-tab` (pull request #1) and merged to `main`. Later work on `main` prints each author's department as a chip wherever a report names them (see **Where department is shown**), and widens the Coordinator role to every budget report in the office while leaving monthly activity reports private (see **Coordinator**).

**The most recent work strips the monthly activity report back to prose and attachments**, removing the task list and the social performance figures ahead of launch — see **Monthly activity report — structured activity data**. That section records why, what a rebuild has to reckon with, and the one way old data can still be lost.

Supabase migrations `0001` through `0012` have been applied to the production project.

`0013` and `0014` were applied and confirmed: the `departments` table holds its eight rows, every assigned department resolves through the new foreign key, and the seeded January–June spend came through the migration to the cent.

> **`0015_budget_approval.sql` has NOT been applied.** Until it runs, the annual budget card fails to read `budget_approvals` and the percentage column stays on its "% of year" fallback. Run it in the Supabase SQL editor or via `supabase db push`.

The team's real January–June 2026 spend is seeded into production — see **Seeded data — Actual Expenses 2026** for what reconciles and the two figures that do not.

No migration is required for the Marketing Communication alignment described below: report content rides in the existing `reports.content` jsonb column.

Latest verification completed successfully:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` with Next.js 16.2.10 and Turbopack
- `git diff --check`

## Product model

MCD Management is an internal office report tracker. Users create two kinds of reports:

1. **Monthly budget report** — actual expenses for one selected month, grouped into freeform sections and line items.
2. **Monthly activity report** — summary, accomplishments, challenges, and next-month plan, plus attached documents.

Every report follows this lifecycle:

`draft → submitted → reviewed`

or:

`draft → submitted → rejected → edited/resubmitted`

or, for an approved report that needs correction:

`reviewed → edited → draft/submitted → reviewed again`

Reports support comments and private file attachments. Reviewed monthly budgets feed the dashboard's annual Jan–Dec summary; draft, submitted, and rejected budgets never enter that summary.

## Role and permission matrix

The office hierarchy, most powerful first:

**Admin › Head of Department › Coordinator › Manager › Staff**

`roleRank()` in `src/lib/roles.ts` is that ordering, and `outranksOrEquals()` answers "may this account act on that one" — you reach accounts at or below your own rank, never above. It is deliberately *not* a general capability ordering: a Coordinator ranks above a Manager and still cannot edit anyone's report.

Approving and rejecting are two permissions, not one:

| | Mark reviewed | Reject | Self-review |
| --- | --- | --- | --- |
| Admin | ✅ | ✅ | ✅ |
| Head of Department | ✅ | ✅ | ✅ |
| Coordinator | ✅ budget reports and their own | ❌ | ✅ |
| Manager | ❌ | ❌ | — |
| Staff | ❌ | ❌ | — |

Rejection sends a report back with required feedback — the one decision that creates work for someone else — so it stays with the Head of Department and the Admin above them.

### Staff

- Create monthly budget and activity reports.
- Edit any report they authored, including submitted and reviewed reports.
- Submit reports for review.
- Edit and resubmit their own rejected reports.
- View and comment on reports allowed by Row Level Security.
- Cannot review reports or access the annual budget summary.
- Editing a submitted/reviewed report clears its reviewer metadata and requires a new review before it can return to the annual summary.

### Manager

**Sees only their own reports.** As of migration 0013 a Manager has no cross-office visibility at all — no other author's pending queue, no other author's reports, no author column, no author filter.

- Has normal report-author capabilities.
- **Cannot review or reject anything, including someone else's report.** Rejection was removed along with the visibility: a Manager can no longer see another author's submitted report, so a reject button would have had nothing in reach. `isReviewer()` no longer includes them.
- Annual budget summary is restricted to their own reviewed monthly expenses, and has no Author filter.
- Does not see the department × month matrix — with one author in scope it would be a single column.
- **Can open the Users page read-only.** They see the office directory but every control is disabled — the role select is greyed, the department shows a chip, and there is no reset-password or delete button — so they can neither manage accounts nor reset a password. `canOpenUsersPage()` includes them; `canManageUsers()` and `canResetPasswords()` do not, and every user Server Action refuses them (`requireUserManager()` / the reset guard), so hiding the controls is presentation over an enforced boundary, not the boundary itself. Reading the list needs no RLS change: `profiles: read all` is already `using (true)`. Staff still cannot open the page.
- Ranks above Staff and below Coordinator in the hierarchy, which governs account management, not report capability.

`profiles.department` records which department a person belongs to, but no visibility rule reads it. A Manager account is still treated as the expense owner for their department. See **Departments** and **Known limitations**.

### Head of Department

**Admin-equivalent, with exactly one exception: they cannot reset a password.** Everything else an Admin can do to a report or an account, they can do.

- Sees every non-draft report across the office, and the department × month spend matrix across every author.
- Can mark reviewed and reject, including on a report they authored themselves.
- Can edit or delete any report, and bulk-delete from the Reports page.
- Can invite accounts, change roles and departments, delete users, and add a department.
- Annual budget summary covers all authors, filterable by year and author.
- **Cannot reset any password.** `canResetPasswords()` is the only capability check that excludes them.
- **Is the only role that can set the approved annual budget** — see **The approved budget**. That is the one capability an Admin does not have.

Two guards keep that exception from being decorative, both enforced in the server actions:

- **A Head of Department cannot grant the Admin role.** Without this, they could promote an account and reset passwords through it.
- **A Head of Department cannot modify or delete an Admin account.** The row's controls are disabled and the action refuses it.

Both are checked against the *target's* current role, read server-side — the client never decides. `profiles: admin all` is deliberately **not** widened to Head of Department for the same reason: it would be a direct API route around both guards.

### Coordinator

- Has normal report-author capabilities.
- **Sees every budget report across the office**, monthly and legacy annual, in every non-draft status — plus its line items, comments, and attachments.
- **Annual budget summary covers all authors**, the same reach an Admin has, with the same author filter.
- **Sees only their own monthly activity reports.** Cross-office visibility stops at budget; the activity tab on their dashboard is their own tasks.
- Read-only on other people's reports. `can_edit_report()` is untouched, so a Coordinator can open a budget report and change nothing in it.
- Cannot review or reject. They are not a reviewer, so their dashboard keeps the personal "Recent reports" framing rather than a pending-review queue they could not act on.
- **Can mark a budget report reviewed**, including one they authored. Approval is the natural end of budget oversight: a budget they already read across every team is a budget they can sign off.
- **Cannot reject anything.** Sending a report back with feedback stays with the Head of Department and the Admin above them.
- Their review reach is **budget reports plus their own** — the same rows they can see. `canDecideOnReport()` keeps the detail page from offering a control the database would refuse, and the `reports: review submitted` policy is scoped to match, because an UPDATE policy's `USING` clause is evaluated on its own and does not inherit the narrower `SELECT` policy.
- Gets the pending-review queue on their dashboard and the department × month matrix.
- Can open the Users page and view the user list.
- Can reset passwords for Staff, Manager, and Coordinator accounts — one of only two roles that can, the other being Admin.
- Cannot invite users, change roles or departments, delete accounts, or add a department. Departments render as read-only chips on their Users page, not as controls.
- Cannot reset Admin or Head of Department passwords, preventing privilege escalation.

Drafts stay private from a Coordinator — a draft is a working copy, not a submission. Note that they are **not** private from an Admin or a Head of Department: `0013` put the Head of Department into the same unrestricted clause as the Admin, who has always read drafts. That follows from "admin-equivalent", but it is a widening worth knowing about, and the `reports: select` policy is where to narrow it if drafts should stay private from everyone but their author.

### Admin

- Has unrestricted report and user-management authority.
- Sees the department × month spend matrix at the top of the Annual budget tab, across every author.
- Can invite users, assign roles and departments, reset passwords, delete users, and add a department.
- Is the only role that can grant the Admin role, or modify and delete an Admin account.
- **Cannot set the approved annual budget.** The single capability an Admin does not hold; it belongs to the Head of Department. See **The approved budget**.
- Can edit or delete reports according to the Admin policies.
- Can select one or more reports on the Reports page and permanently delete them together after confirmation.
- Can mark any submitted report reviewed or rejected, including a report authored by the same Admin account.
- Annual budget summary includes reviewed monthly budgets from all authors.
- Can filter the annual summary by year and any author.

## Budget-report implementation

### Monthly-only entry

- New budget reports are always monthly.
- The removed Annual/Monthly form toggle cannot be bypassed: the server action rejects attempts to create a new annual budget report.
- Existing legacy annual reports remain readable and editable so historical data is preserved.
- The database still retains `budget_period` to distinguish legacy annual records from current monthly records.
- **Multiple monthly budgets per author/month/year are allowed.** The office asked to lift the earlier one-per-period rule (a team may file more than one budget report for the same month, e.g. one per purchase). Migration `0016` drops the `0009` uniqueness trigger; the client form's duplicate banner + disabled buttons and the Server Action's duplicate check were removed with it. **`0016` must be applied in Supabase** — until it runs, the DB trigger still rejects a second budget for the same period with a 23505 the UI now surfaces as a raw error.
- Aggregation already tolerates multiples: the annual summary and the department × month matrix sum every reviewed monthly budget, so several reports for one month simply add together. The `0009` lookup index (non-unique) is kept.

### Form structure

- A budget has freeform sections, such as `Social Media` or `Website`.
- Each section contains freeform line items, such as `Instagram`, `Facebook`, `Domain`, or `Vercel`.
- The selected report month exposes one actual-amount input per item.
- Section subtotals and the report grand total update immediately.
- Amounts are stored in the corresponding `m01`–`m12` column; months outside the selected period are stored as zero.

### Historical structure reuse

When a user creates a new monthly budget, the form finds that user's nearest earlier monthly budget report:

- Section names and line-item names are copied into the new form automatically.
- Current-month amount inputs start empty; historical spend is never copied as the new month's spend.
- The previous month's amount is displayed beside each reused line item for reference.
- Example: if July contains `Social Media → Instagram → $110`, August starts with `Social Media → Instagram`, an empty August amount, and the reference `Previous Jul 2026: $110`.
- Users can add, remove, or rename sections and items.
- Changing the reporting period automatically selects the appropriate earlier structure only while the form is untouched.
- Once the user edits the structure or an amount, changing the period does not silently erase their work; the form offers an explicit option to replace it with the available historical structure.
- Historical queries are scoped to the signed-in author and reuse existing report data, so this feature required no additional migration.

This reduces repeated typing and helps prevent annual-summary duplicates caused by variations such as `Facebook` versus `Fabook`.

## Annual budget summary

The dashboard constructs the annual table dynamically from `budget_items` joined to `reports`.

Required inclusion conditions:

- `reports.type = 'budget'`
- `reports.budget_period = 'monthly'`
- `reports.status = 'reviewed'`
- `reports.period_year` matches the selected fiscal year
- The report author is inside the current role's permitted scope

Aggregation behavior:

- Items are grouped by trimmed, case-insensitive `section + line-item name`.
- Matching rows from reviewed monthly reports are summed into `m01`–`m12`.
- Section subtotals, monthly totals, and the annual grand total are calculated for display.
- Reach is decided by `annualBudgetScope()` in `src/lib/auth.ts`, which returns `all`, `managers`, or `own`. It is one function rather than a pair of role booleans because the query scope, the author filter, and the card's own description all have to agree — and they drifted apart the last time each answered the question for itself.
- `all` — Admin and Coordinator. Unrestricted.
- `managers` — Head of Department. Limited to authors whose profile role is `manager`.
- `own` — Manager. Always pinned to that Manager's user ID.
- When a scope that reaches several authors selects the all-author option, the summary renders a separate grid under each author's name instead of merging identical section/item names across people.
- Selecting one author keeps the focused single-grid summary.
- Staff dashboards do not render or query the annual summary.
- The summary is streamed behind a Suspense loading skeleton so it does not block the rest of the dashboard.

### Department × month matrix

Sits at the top of the Annual budget tab, above the per-author grids. Modelled on the spreadsheet the team keeps today: months down, departments across, a subtotal per department and per month, and each month's share.

- **Admin and Head of Department only** — `canViewDepartmentMatrix()`, deliberately narrower than `canViewAnnualBudget()`. A Manager sees only their own figures, so their matrix would be a single column. A Coordinator's budget access exists for oversight of individual reports, not for reading the org chart off the spend.
- **No extra query.** It is aggregated from the `sourceItems` the summary already fetched, with the department resolved through the author list it already has. That is also what guarantees it reconciles with the grids below it — same scope, same year, same author filter, one set of numbers. If it ever disagrees with the totals underneath, the aggregation is wrong, not the data.
- **A department is the department of the person who filed the report.** There is no department on `reports` itself; it is read from `profiles.department` through `author_id`. Reassigning someone therefore moves their whole history to the new column, which is correct for "which team spends what" and wrong for "what did the old team spend" — the second question needs a department stamped on the report at submission time, and nothing asks it yet.
- **Reports by an author with no department get an Unassigned column.** Dropping them would leave a table whose department columns do not add up to its Total, which is worse than an ugly column.
- **Empty department columns are dropped; empty month rows are kept.** An all-zero column is a wider table that says nothing. An all-zero month is the shape of the year, and hiding it would hide that nothing was reported.
- **One department means no Total column**, since it would be identical to the single department column all the way down and read as a rendering fault.
- Amounts come from `m01`–`m12` directly rather than from `reports.period_month`, so the month split does not depend on the report's period field.
- A table, not a chart, on purpose: the question is "what did Multimedia spend in April", which is a cell lookup, and the month shape and section ranking are already charted directly beneath it.
- The current month is tinted ivory rather than red — the Total row already owns the brand red, and two red rows in one table read as two instances of the same thing.

### The approved budget

`public.budget_approvals` holds one figure per fiscal year — the workbook's `Budget Approval: $150,000.00` line — and migration `0015` seeds FY2026 with it.

- **Keyed by year, not hardcoded.** The figure is re-approved annually; a constant would make January a code change.
- **One office-wide figure, not one per department.** That is what the workbook holds. A per-department split would need the org to actually allocate that way before the app can claim it does; if that changes, add a nullable `department` column and treat NULL as the office-wide total.
- **It becomes the percentage column's denominator.** With an approval set the column header reads **% of budget** and answers the question the workbook asks — how much of what we were given have we spent. Without one it falls back to **% of year**, each month's share of the year's own spend, which is a different and much weaker fact. The header changes with it so the two can never be confused.
- The **Total row** is the headline figure against an approval (22.73% of the year's money spent) where it was previously 100% by construction.
- **`BudgetApprovalBar`** states the denominator above the matrix rather than leaving it to be inferred from a column header, and shows spent and remaining beside it. Overspend reads as "$X over" rather than as a negative remaining, which looks like a rendering fault.

#### The consumption meter

A ring, built as a **meter and not a two-slice donut**. The unspent portion is a recessive track in the surface's own ramp, not a second coloured segment, so the reader compares one arc against a limit instead of judging two wedges by area. A pie of two slices is the anti-pattern this replaces.

- **Status colours, never the categorical `--series-N` palette.** Budget consumption is a state against a limit, not an identity. Painting it with series hues would claim "spent" and "remaining" are peer categories; one is a measure and the other is what remains of its limit.
- Thresholds, from the single `WARN_AT` constant so the tick, the arc colour and the banner wording cannot disagree: **under 80% good · 80–100% warning · over 100% critical**.
- **The 80% line is drawn on the track**, so the threshold is visible rather than a rule that exists only in prose.
- **Over 100% the arc caps at full** and the overage is stated in words. An arc that laps itself reads as a smaller number than it is.
- **The warning is a sentence with an icon, and that is not decoration.** `--status-warning` measures **1.83:1** against the light card — below the 3:1 a mark needs to carry meaning alone — so the ring can never be the only thing saying "you are close". Good (3.35:1) and critical (4.80:1) pass on their own; the banner exists for the one that does not. The figure in the hole clears 15:1 and is what a monochrome reader actually reads. Verified with the `dataviz` skill's `contrast()`, not by eye.
- Do not re-colour the arc, move the threshold, or drop the banner without re-running that contrast check.
- **Setting it is the Head of Department alone — including against the Admin.** `canSetBudgetApproval()` is the one capability in `roles.ts` an Admin does not have, and it is deliberate: approving a budget is financial authority, not administrative authority, and running the system is not the same as deciding what the office may spend. An Admin still reads the figure, and can still grant themselves the role if they genuinely need to change it — the point is that doing so is a visible act rather than a quiet one.
- The write uses the service-role client, which bypasses RLS, so **the server action guard is the enforcement** — there is no second layer behind it. Do not add a UI path to this action without re-checking `canSetBudgetApproval()` inside the action itself.
- The empty state says different things to the two audiences: the Head of Department is told to set it, everyone else is told who will.
- The bar's "spent" and the matrix's Total row are computed from the same array, so they cannot disagree.

## Monthly activity report — structured activity data (removed, to return)

**The task list and the per-platform social figures were built, shipped to `main`, and then removed before launch.** What remains of the monthly activity report is four blocks of prose — summary, accomplishments, challenges, next month plan — plus attached documents.

### Why they were removed

Each team writes the month up differently, and the Head of Department wants the application in front of them now rather than after the structured fields are made to fit every team. A typed task list and a fixed metric grid both assume one shape of report; forcing that shape before the teams have agreed one would have made the form wrong for most of them and delayed the launch to fix it.

Attachments carry the burden instead. A team files whatever document they already produce, alongside the narrative — which is what the four text fields were always for.

### What was removed, and where it went

| Piece | Was | Now |
| --- | --- | --- |
| Tasks card on the form | `content.tasks: [{ name, type }]` | gone; `TASK_TYPES` deleted from `src/lib/types.ts` |
| Social media performance card | `content.metrics: [{ platform, values }]` | gone; `PLATFORMS`, `METRICS`, `PlatformMetrics` deleted |
| Task/metric validation in `saveReport` | zod schemas, coercion, dedupe | gone |
| Tasks + figures on the report detail page | two blocks above the narrative | gone |
| Dashboard **Monthly activity** tab | task-mix donut, "What was done" list, activity trend line | `monthly-activity-summary.tsx` — the month's reviewed reports, each with its four narrative sections and its attachments as download links |

`monthly-task-summary.tsx` and `monthly-task-charts.tsx` were deleted. The tab itself, its Suspense boundary, and its URL filters (`task_year`, `task_month`, `task_author`) all survive unchanged, so the tab rail and the scoping rules below still describe the dashboard.

**Reports written before the removal still carry `tasks` and `metrics` keys in `reports.content`.** No migration touched them and none is planned — the column is jsonb, so the keys cost nothing and are the only surviving copy of that data in the application. Nothing reads them. Note that `saveReport` rebuilds `content` from the form on every save, so **editing an old monthly report through the UI drops its `tasks` and `metrics` for good.** If those figures matter, export them before anyone edits the reports holding them. The April 2026 seed (see below) writes both keys and remains a faithful transcription of the source PDF.

### The tab that remains

The dashboard chart area is two tabs: the existing **Annual budget** summary and the **Monthly activity** panel. Each streams behind its own Suspense boundary and keeps its own URL filters so switching tabs never re-filters the other. A user without annual-budget access — Staff — sees the activity panel alone with no tab rail, which is why that panel could not simply be deleted along with its charts.

**The two tabs deliberately work at different time scales.** The budget tab rolls twelve months into one fiscal-year view, because that is what an annual budget is. The activity tab shows **one month at a time**, because that is what a monthly report is. The month selector lists only months that actually have a reviewed report behind them, so it never offers a dead end. With no explicit month in the URL, the panel opens on the newest month that has a report rather than on the calendar month, which would show an empty card whenever the team is behind on write-ups.

The panel shows **reviewed** monthly activity reports only, scoped exactly like the budget tab (Admin sees everyone, Head of Department sees Managers, everyone else sees only their own).

### Bringing structured activity data back

This is the same work as **Phase 1** and **Phase 2** below, with one lesson learned: the taxonomy has to come from the teams before it goes into an array. Whoever picks this up should start by collecting one real monthly report from each team and finding what they genuinely share, rather than restoring `TASK_TYPES` from git history and assuming it fits.

The deleted code is recoverable — `git log -- src/components/monthly-task-charts.tsx` — and the removal commit is the fastest way to see every touch point the feature had.

### Chart colour tokens

`--chart-1` through `--chart-5` are the stock shadcn theme slots. They fail as a categorical set — two are near-grey and the gold sits outside the usable lightness band — and are kept only because the generated components reference them. **No chart uses them.**

`--series-1` through `--series-6` in `globals.css` are the palette the dashboard actually draws with, defined for both themes and validated as a set for lightness band, chroma floor, protanopia/deuteranopia separation, normal-vision separation, and contrast against the card surface. The order is the CVD-safety mechanism, so slots are never reordered or cycled.

Six slots are still defined although only two are currently drawn with. The set was validated whole, and slots 3–6 existed for the task-mix donut's categorical series; keeping them means restoring that chart repaints identically rather than requiring the palette to be re-validated. **Do not trim the unused slots.**

Current assignments:

| Chart | Form | Colour | Why |
| --- | --- | --- | --- |
| Spend by month (budget tab) | vertical bars | `--series-1` red | brand mark leads the budget card |
| Biggest line items (budget tab) | horizontal bars | `--series-2` gold | second brand hue, distinct from the chart beside it |

`--series-neutral` graphite is currently unused. It existed so the activity trend line would not rhyme with a donut slice beneath it; it becomes relevant again the moment a context line shares a card with a categorical chart.

**Contrast obligations.** `--series-2` (gold) sits at 2.17:1 on white, below the 3:1 mark threshold. It is legal on Biggest line items *only* because that chart prints a value on every bar; remove those labels and the colour must change. Slots 3 and 5 are likewise under 3:1 and carry the same obligation for whatever draws with them next. **Do not hand-edit a hex, reorder the slots, or move a colour to another chart without re-validating the set and checking the relief obligation travels with it.**

## Seeded data — Actual Expenses 2026

`supabase/seed/actual_expenses_2026.sql` holds the team's real January–June 2026 spend, transcribed from their `Actual Expenses 2026 (Summary (Printing))` workbook. It lives outside `supabase/migrations/` on purpose: it is data, not schema, and must never be mistaken for schema history or auto-applied.

**Applied.** 28 reports and 112 line items are in production, all tagged `content->>'seed' = 'actual-expenses-2026'`. That tag is the undo: deleting on it removes the seed and nothing else, and the script deletes by it before each run so it is safe to re-run.

Sheet block → department, by way of the report author's profile:

| Sheet block | Department | Account |
| --- | --- | --- |
| PR / Communication | Brand Marketing | Jeriko Enriquez |
| Event | Event Marketing | Steven Kim |
| Digital | Digital Marketing | Soputhyka Kong |
| Multimedia | Multimedia | Sophal Chan |
| Coordination | Admin/HR | Kosal Phal |
| CSR, Partnership | Partnership Marketing | **none — not seeded** |
| Products | Product Marketing | no spend in 2026 |

### What reconciles, and what does not

Brand Marketing, Event Marketing, Digital Marketing and Admin/HR match the workbook to the cent, month by month. Two gaps remain, both recorded rather than papered over:

- **Partnership Marketing, $3,582.00 in April, not seeded.** No account is assigned to that department, and a department is read from the author's profile, so there is nowhere for the figure to land. Assign someone and re-run the seed; it is idempotent.
- **Multimedia January is $24.90, not $387.90.** The source workbook does not add up here: the itemised rows give $24.90 but its own TOTAL row and the summary matrix both say $387.90 — a difference of exactly $363.00, which is also the Dell Monitor figure sitting in February. Nothing was invented to close it. Multimedia therefore reads $4,878.88 for the year against the workbook's $5,241.88. Add the missing January line once someone identifies it.

Together those two explain the whole variance: $38,038.68 in the workbook, $34,093.68 seeded.

### Transcription decisions

- **Line-item names are verbatim**, apart from four typo fixes — `Adobe Creative Clound` → `Cloud`, `iCould Drive` → `iCloud Drive`, an unclosed `Office Expense (OCIC Wall`, and `Cooporate Event` → `Corporate Event`. The annual summary aggregates by normalised text, so seeding a misspelling would guarantee a mismatch the first time somebody types it correctly.
- **Section names are normalised**, because the sheet's `Categorise` column holds several values in one cell. Four Event rows carry two categories and were filed under the dominant one; the seed file lists which.
- **Months with no spend produce no report.** An empty report is a filing that never happened.
- **Line items with no spend in a month are omitted from that month's report**, so Digital's YouTube and Telegram — tracked in the sheet, never spent on — do not appear.
- **Reports are dated to their period**, not to the day the seed ran, so the timeline reads as a filing history rather than as thirty reports landing at once.
- "Coordination" has no entry in `DEPARTMENTS` and is seeded as **Admin/HR** — its contents are petty cash, office expense, online tools and subscriptions. If it should be its own department it needs a `DEPARTMENTS` entry, a migration widening the check constraint, and a change to the seed.

## Marketing Communication report alignment

Planned, not started. Scope was derived from a real departmental report, `April2026-Marcom-KTI` (Marketing Communication-KTI, 1–30 April 2026), which is the format the team actually produces today.

### What that report contains

| Report section | Application today | Gap |
| --- | --- | --- |
| 1.1.1 Content creation pie (Reel/video, Photo Album, Story) | none | content log, counted by format |
| 1.1.2 Content published per platform | none | same log, grouped by platform |
| 1.1.3 Media engagement (local/international outlets) | none | two tag lists |
| 1.2 Achievements narrative | Summary field | none |
| 1.2.1–1.2.3 Facebook/Instagram/TikTok performance | none | per-platform metric entry |
| 2 Other tasks | none | structured task list |
| 3 Problems (coordination; equipment and manpower) | Challenges field | split into named categories |
| 4 Budget spent | monthly budget report | link the two records |
| 5.1 Team management feedback | Challenges field | own field |
| 5.2 Next month goals | Next month plan field | none |
| 5.3 General feedback and discussion points | none | own field |

Section 2 and the section 1.1.1 pie are two different countable things: 1.1.1 counts content pieces by **format**, while section 2 lists non-content work by **task type**. Both belong in the application, as separate lists. A task list matching section 2 was built and then removed before launch — see **Monthly activity report — structured activity data** for why, and read that section before rebuilding either list.

### Phase 1 — content log and report structure

The mechanical part of the report, and the part that removes the most manual chart-building.

1. **Content log.** A repeating row on the monthly activity form: content title, format, and the platforms it was published to. Stored in `content.content_items`. Formats follow a fixed array in `src/lib/types.ts` (Reel/video, Photo album, Story, and room to append), so the taxonomy stays editable in one place — the pattern `TASK_TYPES` used before it was removed.
2. **Content creation chart.** A donut of pieces by format — the direct equivalent of report section 1.1.1 — reusing the existing `--series-N` palette. The legend/table treatment built for the old task mix is in git history and is the reference to copy.
3. **Content published chart.** A grouped bar of pieces per platform, split by format, matching report section 1.1.2. Platform is the axis; format is the series, capped at the validated palette.
4. **Media engagement.** Two tag lists, local and international, entered as free text and rendered as chips on the report detail page.
5. **Report structure.** Split the single Challenges textarea into the categories the real report uses — Coordination, Equipment and manpower, Team management feedback — and add General feedback and discussion points. Existing reports keep their current Challenges text; the new fields start empty.
6. **Budget link.** Show the author's monthly budget report for the same period on the activity report, so section 4 stops being retyped.

Phase 1 needs no migration and no third-party integration.

### Phase 2 — platform performance

Deliberately deferred until Phase 1 has been used for a month, because this is where the data-entry burden lands.

1. **Metric entry.** Per-platform metric sets, defined per platform rather than shared — the real report already uses different metrics for TikTok (total reach, profile views, shares) than for Facebook (link clicks, visit rate). Roughly twenty numbers per month, copied by hand from the Meta and TikTok dashboards.
2. **Automatic period comparison.** Only the current month's figures are entered. The previous month's reviewed activity report is already in the database, so the application computes the previous value and the percentage change itself. This removes about two thirds of the numbers the team currently types, and removes the arithmetic errors with them.
3. **Presentation — do not copy the source charts.** The report's existing performance charts plot views (123,167) on the same axis as engagement rate (5.02) and percentage change (−28.8%). Every small metric collapses onto the baseline, and real results are hidden: April's Facebook link clicks rose 372% and its visit rate 221%, and neither is legible in the chart meant to show them. Render each platform as a row of comparison tiles instead — metric name, current value, previous value, signed change with direction colour. Same data, no scale collision, and the movements the narrative talks about become visible. A single-axis chart per metric group is acceptable; one chart carrying counts, rates, and percentages together is not.

### Known constraints for Phases 1 and 2

- Automatic metric collection would require Meta Graph API and TikTok Business API integrations, each needing app review and stored tokens. Neither phase assumes it; entry stays manual but becomes structured and automatically diffed.
- The source spreadsheet behind the April report has not been reviewed. Metric names in Phase 2 should be confirmed against it rather than transcribed from the rendered PDF, where several axis labels are truncated.
- The current report is authored by a team ("Heng Sokchea, Duong Senghon") while the application models a single `author_id`. This is the same gap already recorded under Known limitations for departments, and Phase 1 does not resolve it.

## Phase 4 — archiving a leaver (future build)

Not started, and the one future item with a deadline attached: it wants building **before** the first person leaves, not after. Until it exists, the only honest advice is "never delete anyone who has filed a report", which is a rule people forget.

### The problem

Deleting a user cascades their whole reporting history out of the database — see **Deleting a user is a hard, cascading delete**. That is correct for an account created by mistake and wrong for everyone else: a leaver's spend still happened, still belongs in the fiscal year, and still has to reconcile against the approved budget.

### Proposal

A nullable `profiles.archived_at`, plus:

1. **Archive replaces Delete as the default action** on the Users page. Delete stays, moves behind a confirmation that names how many reports and how much spend it would destroy, and is Admin-only.
2. **An archived account cannot sign in.** The check belongs beside the office-domain rule in `src/lib/login-rules.ts`, and needs a matching guard in `getProfile()` so an existing session is ended rather than merely blocked at the login form.
3. **Their reports stay everywhere they already appear** — annual summary, department matrix, reports list, charts. Nothing about aggregation changes, because nothing about the data changes.
4. **They disappear from things that imply a live account**: author filters, the invite/role controls, and the pending-review queue.
5. **Archived is visible, not hidden** — the Users page shows them in a muted state with the date, so "where did Sokchea go" has an answer on the page rather than in someone's memory.

### Constraints for whoever builds it

- `profiles` already carries `role` and `department`; adding a third status column is not a schema problem. The work is in the read paths that currently assume every profile is a live person.
- **`reports.author_id` must keep its cascade.** Archiving is not a substitute for delete, it is the thing you do instead of reaching for delete. A genuine erasure request still has to work.
- The **department × month matrix reads a department off the author's current profile**, so an archived author keeps contributing to their department's column. That is correct and worth stating, because it looks like a bug the first time someone notices a departed colleague in this year's totals.
- Storage cleanup only matters on real deletion; archiving touches no files.

Estimated at half a day, most of it in the session guard and in auditing the read paths rather than in the column itself.

## Phase 3 — chart cross-filtering (future build)

Not started, and **now blocked on Phase 1**: the donut it was designed around was deleted with the task mix, so there is currently no categorical chart to filter. The budget half of the proposal still stands on its own. Everything below is kept because the reasoning survives the chart it was written for.

### What the charts do today

Every chart on the dashboard is read-only. There is no click handler in `annual-budget-charts.tsx`.

- Hovering a bar shows a tooltip with the label and value.
- The bar charts pass `accessibilityLayer`, so they can be tabbed into and arrowed through from the keyboard.
- The deleted donut had no such layer. Its legend list was the keyboard and screen-reader readout instead, and printed every count and percentage — a pattern any replacement donut should keep.

### Proposal

Selecting a category filters the other charts in the same card. On the budget tab — the half that is buildable today — selecting a line item in **Biggest line items** would narrow **Spend by month**. Once Phase 1 restores a categorical activity chart, the same pattern applies there: choosing a format or task type narrows the per-month chart, the stat tiles, and the ring to that one alone.

No new query and no server round trip. The chart components already receive every entry and do their grouping in the browser, so the filter is local component state over data that is already loaded.

### Build the control on the legend rows, not the slices

Clicking the slices is the obvious design and the wrong one to build first, for three reasons:

1. On touch, a tap already means "show the tooltip". Tap-to-filter collides with it.
2. SVG arc paths are not keyboard-reachable, so a slice-only control is mouse-only and fails the accessibility bar the rest of these charts already meet.
3. A five-percent slice is roughly a fifteen-pixel target.

The legend rows are already present, already name the type in text, and become native `<button>` elements at no layout cost — keyboard-reachable, generously sized, and with room for a visible selected state. Wire those as the control, then add the slices as a mouse shortcut on top.

Whatever is built must keep a clear, visible way to return to the unfiltered view. A filtered chart that looks like an unfiltered one is worse than no filter.

### Scope boundary

Filtering stops at the card. The **Pending review** list, **Status mix**, and the three gauge tiles all count *reports*, while an activity chart counts *tasks or content pieces*, and a single report contains several. "Show only Video & photo" has no coherent answer for a card whose unit is the report, so those must not be wired into the filter.

### Constraint for whoever builds this

Colour follows the entity, never its rank. Filtering a ring down to three categories must not repaint the survivors. The deleted `taskTypeColor()` resolved a type's colour from its index in `TASK_TYPES` rather than from its position in the chart; whatever replaces it must do the same, and must not be built on rank-based assignment.

Estimated at a few hours, most of it in the selected and cleared states and keyboard behaviour rather than in the filtering itself.

## Review workflow and enforcement

Review controls only appear when the report is `submitted` and the current role/ownership combination is permitted.

- **Mark reviewed:** Admin, Head of Department, or Coordinator. A Coordinator reaches budget reports and their own only.
- **Reject:** Admin or Head of Department; rejection requires a comment.
- **Self-review:** allowed for all three. It is the decision most worth revisiting — self-review is what review exists to prevent. Restoring it means putting the author check back in `review_report()` and `enforce_report_review_transition()`, both in `0014`.
- **Manager and Staff:** no review authority. A Manager lost it along with their cross-office visibility in `0013` — see the role matrix.
- Authors can edit submitted or reviewed reports. A saved revision first returns to `draft`; choosing Submit for review moves the revised content to `submitted` and clears the previous `reviewed_by`/`reviewed_at` values.

The rule is enforced in three layers:

1. Conditional controls on the report detail page.
2. Authorization inside the Next.js Server Action.
3. Supabase review policy, transactional `review_report` RPC, and `enforce_report_review_transition` trigger.

The RPC updates the status and adds an optional review comment in one transaction. The database trigger protects the workflow even if a caller bypasses the application UI or calls the database directly.

## User administration

The Users page uses the server-only Supabase secret client for Auth Admin operations.

- Accounts are created immediately with a generated temporary password; SMTP is not required.
- New database profiles are always created as `staff` by the authentication trigger, preventing role injection through user metadata.
- Only the Admin server action can assign an elevated role after account creation.
- Temporary passwords are displayed once and must be shared securely.
- Users cannot change their own role through the management UI.
- Users cannot reset their own password from the *management* page, but every signed-in user can set their own password on the **Profile page** (see below).
- Coordinator restrictions are enforced again inside each Server Action, not only by hiding buttons.

### Self-service profile and password

`/profile` (in the `(app)` group, linked from the sidebar for every role) shows the signed-in user their name, email, role and department read-only — role and department stay admin-only — and lets them change their own password. This is the counterpart to the invite flow: an account is created with a temporary password the admin hands over, and the user replaces it here.

- **The change re-checks the current password first.** `changePassword` in `src/app/(app)/profile/actions.ts` calls `signInWithPassword` with the submitted current password before `updateUser`, because `updateUser` trusts the session alone — without the re-check a borrowed or hijacked session could set a new password and lock the owner out. A wrong current password returns "Your current password is incorrect".
- Validation (zod): new password ≥ 8 characters, must match its confirmation, and must differ from the current one. The form (`src/components/change-password-form.tsx`) clears its fields on success and reuses the shared `useActionToasts`.
- No new dependency and no migration — it is Supabase Auth's own `updateUser` on the user's session.

### Deleting a user is a hard, cascading delete

There is no deactivation and no undo. One delete takes the account and everything hanging off it:

| Constraint | On delete |
| --- | --- |
| `auth.users` → `profiles` | cascade |
| `profiles` → `reports.author_id` | cascade |
| `reports` → `budget_items` | cascade |
| `reports` → `report_comments` | cascade |
| `reports` → `report_attachments` | cascade |
| `profiles` → `report_comments.author_id` | cascade |
| `profiles` → `reports.reviewed_by` | **set null** |
| `profiles` → `budget_approvals.updated_by` | **set null** |

So it removes their account, **every report they authored**, all line items, comments and attachments on those reports, and **every comment they wrote on anyone else's report** — those other reports survive with the comment missing.

Two things survive: reports they *reviewed* stay reviewed, with the reviewer null so the detail page reads "Unknown"; and the approved budget figure outlives whoever set it.

Attachment **files** are handled outside the database. `deleteUser` collects the storage paths first, deletes the account, then removes the objects. If that last step fails the action returns "User deleted, but some attachment files could not be cleaned up" and orphaned files remain in the bucket.

**Nothing warns you how much is about to go.** As of the 2026 seed, deleting the Brand Marketing author removes $14,120.39 — 41% of all recorded spend — from the matrix, the annual summary, and every chart, silently. Deleting your own account is blocked, which is the only guard in place.

**Operational guidance until an archive exists:** do not delete anyone who has filed a report. Nothing in the schema separates "left the company" from "never existed", so removing a leaver erases their spend history from the books. Instead either **demote them to Staff** and leave the account dormant — their reports stay in the summary and they lose access to everything but their own — or **reset their password** to something nobody holds, if the login should die but the record should not.

Data seeded from `supabase/seed/actual_expenses_2026.sql` is re-runnable, so the January–June 2026 figures specifically are recoverable. Anything typed into the app since is not.

## Sign-in restriction

Only office accounts may sign in. Both the rule and the post-login redirect check live in `src/lib/login-rules.ts` so a new caller cannot reintroduce a weaker version of either.

- `ALLOWED_EMAIL_DOMAIN` is `@ocic.com.kh`. Changing offices means changing that one constant.
- The login action checks the domain **before** calling Supabase Auth, so a personal address is never attempted as a credential, and the rejection message names the required domain instead of reading as a wrong password.
- The invite action applies the same rule through a zod `.refine`, so an Admin cannot create an account that would then be unable to sign in.
- `safeNextPath` accepts only a same-origin absolute path. It rejects `//evil.com` and `/\evil.com` — browsers normalise `\` to `/` in the authority position — and anything carrying a scheme. Control characters are stripped first so a smuggled tab or newline cannot make the test disagree with what the browser eventually parses. The login page, the login action, and the proxy all route their `next` value through it.
- This is a convenience and anti-typo guard on the client path, not the security boundary. Row Level Security and the Server Action role guards remain the authority.

## Attachments and comments

- Attachments are uploaded inside the report save action.
- The report form's picker is `src/components/ui/file-upload-card.tsx` — a drag-and-drop dropzone with a removable selected-file list. It has **no progress bars**: the form posts to a Server Action, so nothing uploads until submit, and a simulated bar would lie. It stays compatible with native submission by mirroring its `File[]` selection into a hidden `<input type="file" name="files">` via the DataTransfer API, so `saveReport` reads the files unchanged. Over-limit files are flagged client-side; the server remains the enforcement.
- Next.js Server Action request limit is configured to 20 MB.
- Each individual attachment is limited to 15 MB.
- Files are stored in the private `attachments` bucket.
- Downloads go through `/api/attachments/[id]`, which creates a signed URL after authorization.
- Attachment rows and storage files can be removed from editable reports.
- Report comments are displayed chronologically.
- Rejection comments are required and saved transactionally with the decision.

## PDF export (budget reports)

There are **two** print-to-PDF exports, both browser-driven — the shared button `src/components/export-pdf-button.tsx` only calls `window.print()`, and the browser's own "Save as PDF" produces the file. This was chosen over a headless-Chromium download to avoid a heavy, cold-start-prone dependency on Vercel; the output is a real vector PDF with selectable text. Both reuse one set of `@media print` rules in `globals.css` that hide the app shell and reveal only the `.print-only` region on the page.

1. **Single report** — an **Export PDF** button on a budget report's detail page. Layout in `src/components/printable-budget-report.tsx`; details below.
2. **Whole annual budget** — an **Export budget PDF** button on the dashboard's Annual budget card, shown to the roles that see the department matrix (Admin, Head of Department) when the current selection has data. Layout in `src/components/printable-annual-budget.tsx`: the FY approval (approved / spent / remaining), the **department × month matrix** with its `% of budget` (or `% of year`) column, then **one line-item table per department** — the shape of the team's *Actual Expenses* workbook. It prints the current year/author selection (what you see is what you print), and reuses the exact `matrixItems` array the on-screen matrix is built from, so the printed totals reconcile with the page. Per-department tables show only the months a department actually spent in, so a portrait page is not overrun by empty columns.

### Single-report layout

- **The printed layout is its own component**, `src/components/printable-budget-report.tsx`, rendered on the detail page but `display:none` on screen. It mirrors the team's hand-made workbook: an OCIC letterhead, a **Name / Department / Date** block (Date is the report period), a **Summary** heading, and the line-item table with a red-italic **% of total** share column and grey section/Total bands. That share column does not exist on the interactive `BudgetGrid`, which is why the print view is a separate component rather than a print stylesheet over the on-screen grid.
- **Monthly reports** print `Line item · <Month> · % of total`. **Legacy annual reports** print `Line item · Q1–Q4 · Total · % of total`, aggregating the twelve `m01`–`m12` columns into quarters — twelve money columns do not fit portrait, and the sample workbook is quarterly.
- **The share denominator is the report grand total**, computed exactly as the on-screen grid computes it (a monthly report on its one month, an annual report across all twelve), so the printed numbers reconcile with the page.
- **Print isolation lives in `globals.css`** under `@media print`: `visibility:hidden` on the whole app shell, `visible` on `.print-only`, which is then lifted to the page origin. Colours are literal brand hex, not the theme tokens, so the document prints on white regardless of the viewer's light/dark theme, and `print-color-adjust: exact` keeps the grey bands and red share column from being dropped to save ink.
- **The letterhead logo uses `priority`** so it eager-loads despite sitting in a `display:none` container; a lazy image there can print blank.
- **Only budget reports** get the button and the print component today. Activity reports are the next format to add (they need a different print body — the four narrative blocks), and the sample for them has not been supplied yet.
- **Attachments are not embedded.** Print-to-PDF only captures the page's own HTML; attached files live in Supabase storage behind signed URLs. Merging them into the PDF would require the server-generated route this deliberately avoids.

## Database migration history

1. `0001_init.sql` — creates roles, profiles, reports, budget items, comments, attachments, RLS policies, storage policies, and profile trigger.
2. `0002_rename_approved_to_reviewed.sql` — renames the positive terminal status from `approved` to `reviewed`.
3. `0003_budget_monthly_grid.sql` — changes budget items to section/name rows with `m01`–`m12` amounts.
4. `0004_security_hardening.sql` — prevents role injection and adds transactional review enforcement.
5. `0005_budget_period.sql` — adds `budget_period` with `annual` and `monthly` values while preserving existing budgets as annual.
6. `0006_head_of_department_role.sql` — adds the Head of Department role and the first HoD-only approval rules.
7. `0007_coordinator_and_admin_review.sql` — adds Coordinator and expands positive approval to Admin and HoD.
8. `0008_admin_self_review.sql` — permits Admin self-review while preserving self-review restrictions for HoD and Manager.
9. `0009_monthly_budget_uniqueness_and_revisions.sql` — permits authors to revise submitted/reviewed reports and blocks new duplicate monthly budgets per author/month/year without deleting existing duplicates.
10. `0010_profile_department.sql` — adds `profiles.department`, the `user_department()` helper, and a self-update policy that pins department the way it already pins role.
11. `0011_event_marketing_department.sql` — widens the department check constraint to include Event Marketing.
12. `0012_coordinator_budget_visibility.sql` — widens `reports: select` and `can_view_report()` so a Coordinator reads every non-draft budget report across the office. Monthly activity reports and `can_edit_report()` are untouched.
13. `0013_departments_table_and_role_powers.sql` — three changes at once, because they overlap on the same policies: departments become `public.departments` with a foreign key from `profiles`; a Manager loses cross-office visibility and every review power; Head of Department becomes admin-equivalent on reports and accounts. **Not yet applied.**

14. `0014_coordinator_review.sql` — splits approving from rejecting. A Coordinator may mark reviewed (budget reports and their own) but never reject. **Not yet applied; run after `0013`.**

15. `0015_budget_approval.sql` — adds `budget_approvals`, one approved figure per fiscal year, seeded with FY2026 = $150,000.00. **Not yet applied.**

16. `0016_allow_multiple_monthly_budgets.sql` — drops the `0009` uniqueness trigger and its function, allowing multiple monthly budgets per author/month/year. Keeps the lookup index. **Not yet applied.**

Migrations `0001`–`0014` are confirmed applied in Supabase; `0015` and `0016` are pending. Do not delete or rewrite an applied migration; add a new numbered migration for future database changes.

## Departments

**Departments are rows in `public.departments` as of migration 0013, not a constant.** An Admin or Head of Department adds one from the Users page — "Add department" beside "Invite user" — and it is usable immediately in every picker, chip, and chart column.

The eight seeded by 0013, in display order: Digital Marketing · Multimedia · Brand Marketing · Product Marketing · KTI Marketing · Partnership Marketing · Event Marketing · Admin/HR.

- **A table with a foreign key, replacing the text column with a check constraint.** The constraint needed a migration per department — `0011` exists solely to add Event Marketing. A foreign key does the same job against a list the app can extend, so the org chart stops being a schema concern.
- **The id is generated from the name once, then frozen.** `departmentId()` slugifies (`Corporate Communications` → `corporate_communications`), and the dialog previews the result before you commit, because renaming later changes the label and never the id. Every profile stores the id, so changing it would orphan them.
- **`short` is for the department × month matrix headers only** — eight full names make a table nobody can fit on a laptop. It defaults to the full name when left blank. Never use it where a department stands alone; "Brand" and "Product" are not names.
- **Nullable, no default.** Accounts that predate the column genuinely have no department, and back-filling everyone into one would be inventing data. Those rows read "Unassigned" until someone sets them.
- **Assignment is Admin and Head of Department only**, enforced in three layers: the Coordinator sees a read-only chip instead of a control, the server action re-checks the role, and the RLS self-update policy pins `department` so a user cannot change their own through the API. That comparison uses `is not distinct from` rather than `=` so a NULL department compares correctly instead of making the predicate NULL and failing every self-update.
- One may set **their own** department. It grants no privilege, and everyone belongs to a department the same as anyone else.
- **No delete-department UI, deliberately.** The foreign key is `on delete set null`, so removing one silently unassigns everyone in it. If that is ever wanted it needs a confirmation that names how many accounts it would clear.

### Where the split modules come from

Two pairs of files exist for the same reason, and both matter if you touch them:

- `src/lib/roles.ts` (pure predicates) and `src/lib/auth.ts` (session + re-export)
- `src/lib/departments.ts` (pure helpers) and `src/lib/departments-server.ts` (the table read)

A client component importing the server half drags the Supabase server client into the browser bundle and the build fails with a "Server Component / Client Component Browser" trace. `app-nav.tsx` imports `canOpenUsersPage` from `roles.ts`, and `add-department-dialog.tsx` imports `departmentId` from `departments.ts`, for exactly that reason. Server code may keep importing everything from `auth.ts`.

### Where department is shown

Every place a report names its author names the department beside it, as a chip — `DepartmentBadge` in `src/components/department-badge.tsx`:

- **Report detail** — after the author on the sub-line.
- **Reports list** — a Department column beside Author. Follows `showAuthor`, since a Staff member's list is entirely their own reports.
- **Dashboard, Pending review / Recent reports** — on each row, outside the truncating span so a long title cannot clip it off.
- **Dashboard, Annual budget summary** — beside the author's name in each group header, which is the fastest way to tell whose figures are whose when two people share a first name.
- **Users page** — the Admin gets the assignment control; the Coordinator gets the same read-only chip.

**One chip style for all eight departments, deliberately.** Department is an attribute of a person, not a state of a report. Giving each department its own hue would put eight categorical colours directly beside the Status column — the one place in those rows where colour already carries meaning — and eight hues cannot be told apart under colour-vision deficiency, so the colour would be decoration some readers cannot use.

The chip is **gold** (`--department`, `--department-foreground`, `--department-edge` in `globals.css`), for a specific reason: gold is the brand's second hue and is the one family no status badge uses — submitted is blue, reviewed emerald, rejected red, draft grey — so a department and a status never read as the same kind of fact. A neutral ivory chip was tried first and is nearly invisible on a white card. 7.5:1 light, 6.8:1 dark. In dark mode the fill only reaches 1.5:1 against the card, so the gold edge is what draws the boundary and is not optional.

The one distinction the chip does draw is **assigned versus not**: a filled gold chip is a real department, a dashed outline is an empty field. That makes the gaps scannable too, which matters while most accounts are still unassigned. A report whose author row is missing entirely reads `—` rather than a chip, because "Unassigned" would claim more than is known.

The monthly report tab is deliberately untouched: it pools every author's tasks into one mix with no per-author breakdown, so there is no author there to label. Grouping that tab by author the way the budget tab does would be the change that creates the need.

Department is otherwise still an attribute of a person — **no query filters on it**. See Known limitations.

## Main code locations

- `src/app/(app)/dashboard/page.tsx` — role-aware dashboard and streamed summary boundaries.
- `src/components/dashboard-chart-tabs.tsx` — annual budget / monthly activity tab rail; both panels are rendered on the server and passed through as props. With no budget access it renders the activity panel alone.
- `src/components/annual-budget-summary.tsx` — reviewed-only annual aggregation and role-specific author scope.
- `src/components/summary-filters.tsx` — year, month, and author/Manager selects, shared by both tabs through the `yearParam`/`monthParam`/`authorParam`/`idPrefix` props. The month select only renders when a tab passes months.
- `src/components/monthly-activity-summary.tsx` — the Monthly activity panel: reviewed-only report lookup, month resolution, role-specific author scope, and each report's narrative sections and attachment downloads.
- `src/components/reports-table.tsx` — report list, accessible Admin selection controls, and bulk-delete confirmation.
- `src/components/printable-budget-report.tsx` — the print-to-PDF letterhead layout for a single budget report; `display:none` on screen, revealed by the `@media print` rules in `globals.css`.
- `src/components/printable-annual-budget.tsx` — the print-to-PDF layout for the whole annual budget (approval, department × month matrix, per-department line items), rendered inside `annual-budget-summary.tsx`.
- `src/components/export-pdf-button.tsx` — the shared Export PDF button; calls `window.print()`, accepts an optional `label`.
- `src/components/ui/luma-spin.tsx` — the loading spinner (size-scalable, `currentColor`-tinted; keyframes in `globals.css`). Used by `src/app/(app)/loading.tsx` (page-navigation loader), `src/components/login-submit.tsx` (sign-in overlay via `useFormStatus`), and `src/components/summary-filters.tsx` (a small spinner shown during the filter-change transition). Tab switching itself is instant and needs none — both panels are pre-rendered.
- `src/components/department-badge.tsx` — the one department chip, used everywhere a department appears.
- `src/components/department-month-matrix.tsx` — the department × month spend table at the top of the Annual budget tab.
- `src/components/budget-approval-bar.tsx` — the approved figure above that table, and the dialog that sets it.
- `src/app/(app)/dashboard/actions.ts` — `setBudgetApproval`, guarded to Admin and Head of Department.
- `src/components/report-form.tsx` — activity/budget form, historical structure reuse, calculations, and serialization.
- `src/app/(app)/reports/actions.ts` — save, submit, delete, review, comment, and attachment actions.
- `src/app/(app)/reports/[id]/page.tsx` — detail view and review-control visibility.
- `src/app/(app)/profile/page.tsx` — the self-service profile page (read-only account details) and `actions.ts` — `changePassword`, which re-authenticates before updating.
- `src/app/(app)/admin/users/page.tsx` — user list with role-specific controls, for Admin, Head of Department, and Coordinator.
- `src/app/(app)/admin/users/actions.ts` — invite, role change, department change, department creation, password reset, and deletion authorization, plus the two guards that keep a Head of Department out of Admin accounts.
- `src/lib/login-rules.ts` — the office-domain rule and the post-login redirect check, shared by the login page, the login action, the invite action, and the proxy.
- `src/lib/roles.ts` — every "who may do what" predicate, as pure functions of role. No server import, so client components can ask the same questions.
- `src/lib/auth.ts` — session access (`getProfile`, `requireRole`) and a re-export of `roles.ts` for server callers.
- `src/lib/departments.ts` — `DepartmentRecord`, `departmentLabel()`, `departmentId()`. Pure; safe in the browser.
- `src/lib/departments-server.ts` — `getDepartments()`, the cached table read.
- `src/lib/types.ts` — roles, reports, budget periods, month keys, and shared data types. `Department` is a plain `string` here: departments are rows, so a closed union would be a lie.
- `src/components/add-department-dialog.tsx` — the Add department button and its id preview.
- `src/components/use-action-toasts.ts` — shared once-only toast for `useActionState` results.
- `src/app/globals.css` — brand theme, the validated `--series-1…6` / `--series-neutral` chart palette, and the `--department*` chip tokens, all defined for both themes. The stock `--chart-N` slots remain for the generated components but no chart draws with them.
- `src/lib/supabase/` — browser, authenticated server, and secret Admin clients.
- `src/proxy.ts` — Supabase session refresh and login redirects.
- `supabase/migrations/` — ordered schema and security history.
- `supabase/seed/` — data, never schema. Run by hand; never auto-applied.

## Deployment state

- GitHub repository: `muni-the-goat/OCIC-MCD-Managment`
- Deployed branch: `main`
- Hosting: Vercel, connected for automatic deployment from GitHub
- Database: Supabase, migrations `0001`–`0014` applied; `0015` pending
- Supabase region: Northeast Asia (Seoul)

## Remaining validation checklist

These are production acceptance checks, not unfinished implementation:

1. Confirm a second monthly budget for the same author/month/year is blocked and the form links to the existing report.
2. Confirm editing a reviewed report removes it from the annual summary until its revision is reviewed again.
3. Confirm an Admin can review their own submitted report.
4. Confirm a Head of Department cannot review their own report but can review a Manager's submitted report.
5. Confirm a Manager's annual summary contains only that Manager's reviewed expenses and has no Author filter.
6. Confirm the Head of Department sees only Manager-authored expenses and can filter by Manager.
7. Confirm the all-author annual summary labels and separates each author's expense grid.
8. Confirm Admin can select one, several, or all visible reports and delete them after confirmation.
9. Confirm Staff do not see the annual summary, and that neither Staff nor Coordinator see bulk-delete controls.
10. Confirm a Coordinator can reset an eligible user's password but cannot invite, change roles, delete users, or reset Admin/HoD passwords.
11. Confirm a Coordinator sees every non-draft budget report on the Reports page and every author in the annual summary, sees no one else's monthly activity report, sees no drafts, and has no Edit, Delete, Mark reviewed, or Reject control on a report they did not author.
12. Confirm a reviewed monthly budget enters the correct annual-summary month while draft, submitted, and rejected budgets stay excluded.
13. Confirm a new monthly budget reuses the nearest earlier section/item structure but leaves current amounts empty.
15. After `0013`, confirm a Manager sees no other author's reports anywhere — no pending queue, no Author column, no author filter — and has no Reject control on any report.
16. After `0013`, confirm a Head of Department can invite, change roles and departments, delete users, edit and bulk-delete reports, and add a department; and that they cannot reset any password, cannot select Admin in either role picker, and see an Admin row with its controls disabled.
17. Confirm "Add department" creates a department that appears immediately in both department pickers and, once someone in it files a reviewed budget, as a matrix column.
18. After `0014`, confirm a Coordinator can mark a submitted budget report reviewed — including their own — has no Reject button anywhere, and gets neither control on someone else's monthly activity report.
19. After `0015`, confirm the percentage column reads "% of budget" and its Total matches spend ÷ $150,000, and that a year with no approval falls back to "% of year".
20. Confirm the Head of Department is the only account with an Edit control on the approved budget — Admin and Coordinator see the figure without one — and that posting to `setBudgetApproval` as an Admin is refused.
14. Confirm the department × month matrix appears for Admin and Head of Department only, that its Total reconciles with the per-author grids below it, and that reports by an author with no department land in the Unassigned column rather than vanishing.

## Known limitations and future options

- `profiles.department` is **displayed and aggregated, but still never used for access control**. Every surface that names an author prints their department, and the department × month matrix groups spend by it — but no RLS policy, report query, or visibility rule reads it. Annual budget visibility still uses the Manager author account as the department boundary, and a Head of Department still sees "all Managers" rather than "my department". That, and a department filter on the dashboard summaries, are the remaining steps; neither needs further schema work.
- The matrix reads a department off the author's **current** profile, so reassigning someone moves their whole spend history to the new column. Correct for "which team spends what", wrong for "what did the old team spend". Fixing the second question means stamping the department onto the report at submission time, which is a schema change and is not worth making until someone actually asks it.
- The author filter dropdowns on both dashboard tabs still list names only. Adding the department would disambiguate two people who share a first name, but it risks truncating inside the select's width and wants a two-line item rather than a longer single line.
- Annual aggregation matches normalized text names; it does not use permanent line-item IDs. Historical structure reuse reduces spelling drift, but a future canonical expense-category table would provide stronger guarantees.
- Multiple monthly budgets per author/month/year are now allowed (migration `0016`); duplicates for one period are expected, not an anomaly, and all of them feed the aggregates. The old note here about a single July 2026 author with three reviewed reports is moot.
- Supabase is hosted in Seoul while users are primarily closer to Southeast Asia, which can add network latency. Moving regions requires creating a new project and migrating data/configuration.
- The project is stored inside OneDrive, which can slow local dependency operations or cause file locks.
- **Deleting a user destroys their entire reporting history**, silently and irreversibly — see **Deleting a user is a hard, cascading delete**. Phase 4 is the fix, and it is the one future item worth doing before it is needed rather than after.
- The next planned work is the Marketing Communication alignment (Phases 1 and 2), chart cross-filtering (Phase 3), and archiving a leaver (Phase 4), all described above.
- Budget reports and the whole annual budget both export to PDF via browser print — see **PDF export (budget reports)**. Still open: a print body for **activity reports** (four narrative blocks, awaiting a sample of that format), an **Excel** export, and — only if attachments must be embedded — a server-generated PDF route.
- Possible future phases beyond it: departments/teams, canonical budget categories, notifications, and audit logs.

## Local environment notes

- Node.js: v22.14.0
- npm: 10.9.2
- Next.js: 16.2.10
- Next.js 16 uses `src/proxy.ts` instead of middleware and treats `cookies()`, `params`, and `searchParams` as async APIs.
- `turbopack.root` is pinned in `next.config.ts` because another `package-lock.json` exists at `Desktop\Web3\package-lock.json`.
- If local installs or builds become slow, pause OneDrive sync or exclude this project directory.
