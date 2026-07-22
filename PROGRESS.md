# MCD Management — Build Progress & Handoff Notes

## Current status

The main reporting workflow is implemented, production-build verified, and pushed to GitHub `main` through commit `8131c6e` (`feat: scroll the month chart sideways on narrow screens`). Vercel is connected to the repository for automatic deployments.

Two commits sit on the unmerged branch `feat/monthly-report-tab` (pull request #1) and are **not yet on `main`, so they are not deployed**:

- `73c5e9c` — office-domain sign-in restriction.
- `6555dbb` — monthly report tab and task mix chart (see below).

Supabase migrations `0001` through `0009` have been applied to the production project. No additional migration is required for the current UI/server-action changes, nor for either phase of the Marketing Communication alignment described below — report content rides in the existing `reports.content` jsonb column.

Latest verification completed successfully:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` with Next.js 16.2.10 and Turbopack
- `git diff --check`

## Product model

MCD Management is an internal office report tracker. Users create two kinds of reports:

1. **Monthly budget report** — actual expenses for one selected month, grouped into freeform sections and line items.
2. **Monthly activity report** — a task list, plus summary, accomplishments, challenges, and next-month plan.

Every report follows this lifecycle:

`draft → submitted → reviewed`

or:

`draft → submitted → rejected → edited/resubmitted`

or, for an approved report that needs correction:

`reviewed → edited → draft/submitted → reviewed again`

Reports support comments and private file attachments. Reviewed monthly budgets feed the dashboard's annual Jan–Dec summary; draft, submitted, and rejected budgets never enter that summary.

## Role and permission matrix

### Staff

- Create monthly budget and activity reports.
- Edit any report they authored, including submitted and reviewed reports.
- Submit reports for review.
- Edit and resubmit their own rejected reports.
- View and comment on reports allowed by Row Level Security.
- Cannot review reports or access the annual budget summary.
- Editing a submitted/reviewed report clears its reviewer metadata and requires a new review before it can return to the annual summary.

### Manager

- Has normal report-author capabilities.
- Can see non-draft reports needed for the review workflow.
- Can reject another author's submitted report with a required comment.
- Cannot mark a report reviewed.
- Cannot review or reject their own report.
- Annual budget summary is restricted to their own reviewed monthly expenses.
- Does not receive an Author filter on the annual summary.

The current schema does not have a separate department table or `department_id`. A Manager account is therefore treated as the expense owner for that department.

### Head of Department

- Can see non-draft reports across the office.
- Can mark another author's submitted report reviewed.
- Can reject another author's submitted report with a required comment.
- Cannot review or reject their own report.
- Annual budget summary includes reviewed monthly budgets authored by Managers.
- Can filter the annual summary by year and by individual Manager.

### Coordinator

- Has normal report-author capabilities.
- Can open the Users page and view the user list.
- Can reset passwords for Staff, Manager, and Coordinator accounts.
- Cannot invite users, change roles, or delete accounts.
- Cannot reset Admin or Head of Department passwords, preventing privilege escalation.
- Cannot review reports or access the annual budget summary.

### Admin

- Has unrestricted report and user-management authority.
- Can invite users, assign roles, reset passwords, and delete users.
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
- Each author is limited to one monthly budget for each month/year period.
- When a period already has a report, the new-report form identifies it, disables duplicate submission, and links directly to its edit page.
- The Server Action repeats the duplicate check, and migration `0009` adds a database trigger so direct API calls cannot create a new duplicate.
- Changing an existing report's period to an already occupied author/month/year is also blocked.
- Production currently contains three reviewed July 2026 reports for one author from before this rule. Migration `0009` preserves those records and blocks further duplicates; it does not delete or merge historical data.

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
- A Manager query is always pinned to that Manager's user ID.
- A Head of Department query is limited to authors whose profile role is `manager`.
- An Admin query remains unrestricted.
- When an Admin or Head of Department selects the all-author option, the summary renders a separate grid under each author's name instead of merging identical section/item names across people.
- Selecting one author keeps the focused single-grid summary.
- Staff and Coordinator dashboards do not render or query the annual summary.
- The summary is streamed behind a Suspense loading skeleton so it does not block the rest of the dashboard.

## Monthly activity report — task mix

On branch `feat/monthly-report-tab`, not yet merged.

The dashboard chart area became two tabs: the existing **Annual budget** summary and a new **Monthly report** summary. Each tab streams behind its own Suspense boundary and keeps its own year/author filters in the URL (`task_year`, `task_author`) so switching tabs never re-filters the other. A user without annual-budget access sees the monthly card alone with no tab rail.

Monthly activity reports gained a structured task list, stored in the existing `reports.content` jsonb as `tasks: [{ name, type }]`. No migration was required.

- The taxonomy is one array, `TASK_TYPES` in `src/lib/types.ts`, which drives the form's type picker, the chart legend, and the colour each type is painted with. Appending to it is the supported way to extend the list; renaming an `id` orphans tasks already saved under it.
- Colour binds to a type's position in that array, never to its rank in a chart, so filtering never repaints the remaining types.
- The Server Action validates the list with zod and coerces an unrecognised type to `other` rather than failing the whole save, so a stale browser tab cannot block a report.
- Reads are defensive: a report written before this feature has no `tasks` key and counts as zero tasks.

The chart counts **reviewed** monthly activity reports only, scoped exactly like the budget tab (Admin sees everyone, Head of Department sees Managers, everyone else sees only their own).

### Chart colour tokens

`--chart-1` through `--chart-5` are single-series brand marks and fail as a categorical set — two of them are near-grey and the gold sits outside the usable lightness band. Six new tokens `--task-1` through `--task-6` were added to `globals.css` for both themes and validated as a set for lightness band, chroma floor, protanopia/deuteranopia separation, normal-vision separation, and contrast against the card surface.

Three of the light-mode hues sit below 3:1 on white. That is permitted only because the values are also carried in text: the legend prints each count and percentage, and a screen-reader table repeats every plotted value. **Do not hand-edit one of these hexes without re-validating the whole set**, and do not remove the legend counts or the table.

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
| 2 Other tasks | task list (above) | none |
| 3 Problems (coordination; equipment and manpower) | Challenges field | split into named categories |
| 4 Budget spent | monthly budget report | link the two records |
| 5.1 Team management feedback | Challenges field | own field |
| 5.2 Next month goals | Next month plan field | none |
| 5.3 General feedback and discussion points | none | own field |

The shipped task list corresponds to section 2 of that report, not to the section 1.1.1 pie. Those are two different countable things: 1.1.1 counts content pieces by **format**, while section 2 lists non-content work by **task type**. Both belong in the application, as separate lists.

### Phase 1 — content log and report structure

The mechanical part of the report, and the part that removes the most manual chart-building.

1. **Content log.** A repeating row on the monthly activity form: content title, format, and the platforms it was published to. Stored in `content.content_items` alongside `tasks`. Formats follow the same fixed-array pattern as `TASK_TYPES` (Reel/video, Photo album, Story, and room to append), so the taxonomy stays editable in one place.
2. **Content creation chart.** A donut of pieces by format — the direct equivalent of report section 1.1.1 — reusing the existing `--task-N` palette and the legend/table treatment already built for the task mix.
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

### Known constraints for both phases

- Automatic metric collection would require Meta Graph API and TikTok Business API integrations, each needing app review and stored tokens. Neither phase assumes it; entry stays manual but becomes structured and automatically diffed.
- The source spreadsheet behind the April report has not been reviewed. Metric names in Phase 2 should be confirmed against it rather than transcribed from the rendered PDF, where several axis labels are truncated.
- The current report is authored by a team ("Heng Sokchea, Duong Senghon") while the application models a single `author_id`. This is the same gap already recorded under Known limitations for departments, and Phase 1 does not resolve it.

## Review workflow and enforcement

Review controls only appear when the report is `submitted` and the current role/ownership combination is permitted.

- **Mark reviewed:** Admin or Head of Department.
- **Reject:** Admin, Head of Department, or Manager; rejection requires a comment.
- **Admin self-review:** allowed.
- **Head of Department/Manager self-review:** blocked.
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
- Users cannot reset their own password from the management page.
- User deletion also removes authored report records through database cascades and attempts to clean up attachment files from Storage.
- Coordinator restrictions are enforced again inside each Server Action, not only by hiding buttons.

## Attachments and comments

- Attachments are uploaded inside the report save action.
- Next.js Server Action request limit is configured to 20 MB.
- Each individual attachment is limited to 15 MB.
- Files are stored in the private `attachments` bucket.
- Downloads go through `/api/attachments/[id]`, which creates a signed URL after authorization.
- Attachment rows and storage files can be removed from editable reports.
- Report comments are displayed chronologically.
- Rejection comments are required and saved transactionally with the decision.

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

Migrations `0001`–`0009` are confirmed applied in Supabase. Do not delete or rewrite an applied migration; add a new numbered migration for future database changes.

## Main code locations

- `src/app/(app)/dashboard/page.tsx` — role-aware dashboard and streamed summary boundaries.
- `src/components/dashboard-chart-tabs.tsx` — annual budget / monthly report tab rail; both panels are rendered on the server and passed through as props.
- `src/components/annual-budget-summary.tsx` — reviewed-only annual aggregation and role-specific author scope.
- `src/components/annual-budget-filters.tsx` — year and author/Manager filters, shared by both tabs through the `yearParam`/`authorParam`/`idPrefix` props.
- `src/components/monthly-task-summary.tsx` — reviewed-only task aggregation and role-specific author scope.
- `src/components/monthly-task-charts.tsx` — task mix donut, per-month column chart, and screen-reader table.
- `src/components/reports-table.tsx` — report list, accessible Admin selection controls, and bulk-delete confirmation.
- `src/components/report-form.tsx` — activity/budget form, historical structure reuse, calculations, and serialization.
- `src/app/(app)/reports/actions.ts` — save, submit, delete, review, comment, and attachment actions.
- `src/app/(app)/reports/[id]/page.tsx` — detail view and review-control visibility.
- `src/app/(app)/admin/users/page.tsx` — Admin/Coordinator user list with role-specific controls.
- `src/app/(app)/admin/users/actions.ts` — invite, role change, password reset, and deletion authorization.
- `src/lib/auth.ts` — centralized role guards and permission helpers.
- `src/lib/types.ts` — roles, reports, budget periods, month keys, the `TASK_TYPES` taxonomy, and shared data types.
- `src/app/globals.css` — brand theme, `--chart-N` single-series marks, and the validated `--task-N` categorical palette.
- `src/lib/supabase/` — browser, authenticated server, and secret Admin clients.
- `src/proxy.ts` — Supabase session refresh and login redirects.
- `supabase/migrations/` — ordered schema and security history.

## Deployment state

- GitHub repository: `muni-the-goat/OCIC-MCD-Managment`
- Deployed branch: `main`, latest commit `8131c6e`
- Open branch: `feat/monthly-report-tab` (pull request #1), two commits ahead of `main`, awaiting merge
- Hosting: Vercel, connected for automatic deployment from GitHub
- Database: Supabase, migrations `0001`–`0009` applied
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
9. Confirm Staff and Coordinator do not see the annual summary or bulk-delete controls.
10. Confirm a Coordinator can reset an eligible user's password but cannot invite, change roles, delete users, or reset Admin/HoD passwords.
11. Confirm a reviewed monthly budget enters the correct annual-summary month while draft, submitted, and rejected budgets stay excluded.
12. Confirm a new monthly budget reuses the nearest earlier section/item structure but leaves current amounts empty.

## Known limitations and future options

- There is no department entity or Manager-to-department mapping yet. Annual visibility currently uses the Manager author account as the department boundary.
- Annual aggregation matches normalized text names; it does not use permanent line-item IDs. Historical structure reuse reduces spelling drift, but a future canonical expense-category table would provide stronger guarantees.
- One pre-existing July 2026 author/period contains three reviewed reports. The uniqueness trigger deliberately preserves them. After deciding which record is canonical, the duplicates can be reconciled and the trigger can later be upgraded to a partial unique index.
- Supabase is hosted in Seoul while users are primarily closer to Southeast Asia, which can add network latency. Moving regions requires creating a new project and migrating data/configuration.
- The project is stored inside OneDrive, which can slow local dependency operations or cause file locks.
- The next planned work is the two-phase Marketing Communication alignment described above.
- Possible future phases beyond it: departments/teams, canonical budget categories, notifications, audit logs, and Excel/PDF export. Export is worth reconsidering once Phase 1 lands, because the team still hand-assembles the PDF that the application would then hold all the data for.

## Local environment notes

- Node.js: v22.14.0
- npm: 10.9.2
- Next.js: 16.2.10
- Next.js 16 uses `src/proxy.ts` instead of middleware and treats `cookies()`, `params`, and `searchParams` as async APIs.
- `turbopack.root` is pinned in `next.config.ts` because another `package-lock.json` exists at `Desktop\Web3\package-lock.json`.
- If local installs or builds become slow, pause OneDrive sync or exclude this project directory.
