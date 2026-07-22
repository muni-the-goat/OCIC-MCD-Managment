# MCD Management — Build Progress & Handoff Notes

## Current status

The main reporting workflow is implemented, production-build verified, and pushed to GitHub `main`. Vercel is connected to the repository for automatic deployments.

The monthly report tab, the office-domain sign-in restriction, and departments were developed on `feat/monthly-report-tab` (pull request #1) and merged to `main`. The most recent work on `main` prints each author's department as a chip wherever a report names them (see **Where department is shown**), and widens the Coordinator role to every budget report in the office while leaving monthly activity reports private (see **Coordinator**).

Supabase migrations `0001` through `0010` have been applied to the production project.

> **Two migrations are pending. Run both in the Supabase SQL editor, or `supabase db push`.**
>
> - `0011_event_marketing_department.sql` — until it runs, selecting Event Marketing for a user fails the check constraint and the assignment is rejected.
> - `0012_coordinator_budget_visibility.sql` — until it runs, the Coordinator's widened budget access is UI-only: the pages will offer the all-author view and RLS will return nothing but their own rows, so the summary reads as empty rather than as broken.

No migration is required for the Marketing Communication alignment described below: report content rides in the existing `reports.content` jsonb column.

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

`profiles.department` now records which department a person belongs to, but no visibility rule reads it. A Manager account is still treated as the expense owner for their department, and Head of Department scope is still "authors whose role is `manager`" rather than "authors in my department". See **Departments** and **Known limitations**.

### Head of Department

- Can see non-draft reports across the office.
- Can mark another author's submitted report reviewed.
- Can reject another author's submitted report with a required comment.
- Cannot review or reject their own report.
- Annual budget summary includes reviewed monthly budgets authored by Managers.
- Can filter the annual summary by year and by individual Manager.

### Coordinator

- Has normal report-author capabilities.
- **Sees every budget report across the office**, monthly and legacy annual, in every non-draft status — plus its line items, comments, and attachments.
- **Annual budget summary covers all authors**, the same reach an Admin has, with the same author filter.
- **Sees only their own monthly activity reports.** Cross-office visibility stops at budget; the activity tab on their dashboard is their own tasks.
- Read-only on other people's reports. `can_edit_report()` is untouched, so a Coordinator can open a budget report and change nothing in it.
- Cannot review or reject. They are not a reviewer, so their dashboard keeps the personal "Recent reports" framing rather than a pending-review queue they could not act on.
- Can open the Users page and view the user list.
- Can reset passwords for Staff, Manager, and Coordinator accounts.
- Cannot invite users, change roles or departments, or delete accounts. Departments render as read-only chips on their Users page, not as controls.
- Cannot reset Admin or Head of Department passwords, preventing privilege escalation.

Drafts stay private from a Coordinator, exactly as they do from a Manager or Head of Department — a draft is a working copy, not a submission.

The split between "can see someone else's report" and "can decide on one" is why `seesOtherAuthors()` exists separately from `isReviewer()` in `src/lib/auth.ts`. Folding the Coordinator into the reviewer check would have handed them a review queue with no controls in it.

### Admin

- Has unrestricted report and user-management authority.
- Can invite users, assign roles and departments, reset passwords, and delete users.
- Is the only role that can set a department, including their own.
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
- Reach is decided by `annualBudgetScope()` in `src/lib/auth.ts`, which returns `all`, `managers`, or `own`. It is one function rather than a pair of role booleans because the query scope, the author filter, and the card's own description all have to agree — and they drifted apart the last time each answered the question for itself.
- `all` — Admin and Coordinator. Unrestricted.
- `managers` — Head of Department. Limited to authors whose profile role is `manager`.
- `own` — Manager. Always pinned to that Manager's user ID.
- When a scope that reaches several authors selects the all-author option, the summary renders a separate grid under each author's name instead of merging identical section/item names across people.
- Selecting one author keeps the focused single-grid summary.
- Staff dashboards do not render or query the annual summary.
- The summary is streamed behind a Suspense loading skeleton so it does not block the rest of the dashboard.

## Monthly activity report — task mix

Shipped and merged to `main`.

The dashboard chart area became two tabs: the existing **Annual budget** summary and a new **Monthly report** summary. Each tab streams behind its own Suspense boundary and keeps its own filters in the URL (`task_year`, `task_month`, `task_author`) so switching tabs never re-filters the other. A user without annual-budget access sees the monthly card alone with no tab rail.

**The two tabs deliberately work at different time scales.** The budget tab rolls twelve months into one fiscal-year view, because that is what an annual budget is. The monthly report tab shows **one month at a time**, because that is what a monthly report is — and because the Marketing Communication alignment will add several more charts to this card, each of which would otherwise be stretched across a year it does not describe. The month selector sits beside the year and author filters and lists only months that actually have a reviewed report behind them, so it never offers a dead end. With no explicit month in the URL, the card opens on the newest month that has a report rather than on the calendar month, which would show an empty card whenever the team is behind on write-ups.

The card holds a **Task mix** donut, a **What was done** list of the month's tasks grouped by type, and an **Activity trend** line chart. The task list scrolls inside a fixed card height so the card cannot grow without limit as Phase 1's charts join it.

### Activity trend

Twelve monthly task totals as a line, with the selected month marked by an enlarged dot. It is year-long by design and does not contradict the month scoping above: the question it answers is "is the month I am looking at a normal one", which is context for the selected month rather than a second subject.

Four decisions in it are deliberate and should survive future edits:

- **Gaps, not zeros.** A month with no reviewed report is `null`, and `connectNulls` is off, so the line breaks. A month nobody has written up is unknown, not a month in which no work was done, and drawing zero through it asserts something the data does not support.
- **Straight segments, not a spline.** `type="linear"`. These are twelve discrete monthly aggregates; a curve would draw values between months that were never measured.
- **No text label on the marked dot.** The axis tick beneath it already names the month and the value is the hero figure at the top of the card. A label would be the third printing of the same number.
- **A written explanation below two months of data**, rather than a lone dot in an empty frame. The section keeps its heading and says what is missing and when the line will appear. With one month of reviewed reports — which is the current production state — this is what renders.

The **Tasks completed** tile also carries a month-over-month delta (`↑ 3 vs March`). It is muted ink with an arrow rather than green/red: more tasks is not self-evidently better, and status colours would assert a judgement the data does not carry. The delta reuses the same previous-period lookup that Phase 2 needs for platform metrics.

### Chart inventory

The dashboard now uses four forms, each chosen for its job rather than for variety:

| Chart | Form | Job | Colour |
| --- | --- | --- | --- |
| Spend by month (budget tab) | vertical bars | compare monthly magnitudes | `--series-1` red |
| Biggest line items (budget tab) | horizontal bars | rank, with long labels | `--series-2` gold |
| Task mix (monthly tab) | donut | part-to-whole, ≤ 6 segments | `--series-1…6` |
| Activity trend (monthly tab) | line | shape of the year | `--series-neutral` |

Monthly activity reports gained a structured task list, stored in the existing `reports.content` jsonb as `tasks: [{ name, type }]`. No migration was required.

- The taxonomy is one array, `TASK_TYPES` in `src/lib/types.ts`, which drives the form's type picker, the chart legend, and the colour each type is painted with. Appending to it is the supported way to extend the list; renaming an `id` orphans tasks already saved under it.
- Colour binds to a type's position in that array, never to its rank in a chart, so filtering never repaints the remaining types.
- The Server Action validates the list with zod and coerces an unrecognised type to `other` rather than failing the whole save, so a stale browser tab cannot block a report.
- Reads are defensive: a report written before this feature has no `tasks` key and counts as zero tasks.

The chart counts **reviewed** monthly activity reports only, scoped exactly like the budget tab (Admin sees everyone, Head of Department sees Managers, everyone else sees only their own).

### Chart colour tokens

`--chart-1` through `--chart-5` are the stock shadcn theme slots. They fail as a categorical set — two are near-grey and the gold sits outside the usable lightness band — and are kept only because the generated components reference them. **No chart uses them.**

`--series-1` through `--series-6` in `globals.css` are the palette the dashboard actually draws with, defined for both themes and validated as a set for lightness band, chroma floor, protanopia/deuteranopia separation, normal-vision separation, and contrast against the card surface. The order is the CVD-safety mechanism, so slots are never reordered or cycled.

The palette does two jobs, both of them identity:

1. **Within a chart.** The task mix donut takes slot N for the Nth entry in `TASK_TYPES`, via `taskTypeColor()`. A type keeps its colour whichever types happen to be present, so filtering never repaints the survivors.
2. **Across charts.** Each single-series chart takes its own slot, so two cards side by side are not the same red. Assignments live beside each chart — `grep "var(--series-"` lists them.

Current assignments:

| Chart | Colour | Why |
| --- | --- | --- |
| Spend by month | `--series-1` red | brand mark leads the budget card |
| Biggest line items | `--series-2` gold | second brand hue, distinct from the chart beside it |
| Task mix | `--series-1…6` | genuinely categorical — one hue per task type |
| Activity trend | `--series-neutral` graphite | see below |

`--series-neutral` exists because the trend line shares a card with the categorical donut. In any of the six hues it would rhyme with a slice — a blue line beneath a blue "Video & photo" arc reads as that one type plotted over time, which is not what it is. Graphite belongs to no category and reads as context, which is the line's actual job.

**Contrast obligations.** `--series-2` (gold) sits at 2.17:1 on white, below the 3:1 mark threshold. It is legal on Biggest line items *only* because that chart prints a value on every bar; remove those labels and the colour must change. Slots 3 and 5 are likewise under 3:1 and appear only in the donut, whose legend prints every count and percentage as ordinary visible text. **Do not hand-edit a hex, reorder the slots, or move a colour to another chart without re-validating the set and checking the relief obligation travels with it.**

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
2. **Content creation chart.** A donut of pieces by format — the direct equivalent of report section 1.1.1 — reusing the existing `--series-N` palette and the legend/table treatment already built for the task mix.
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

## Phase 3 — chart cross-filtering (future build)

Not started. Independent of Phases 1 and 2; it can be built before, between, or after them, and would automatically extend to whatever charts Phase 1 adds.

### What the charts do today

Every chart in both dashboard tabs is read-only. There is no click handler anywhere in `monthly-task-charts.tsx` or `annual-budget-charts.tsx`.

- Hovering a donut slice or a bar shows a tooltip with the label and value.
- The bar charts pass `accessibilityLayer`, so they can be tabbed into and arrowed through from the keyboard.
- The donut has no such layer. Its legend list is the keyboard and screen-reader readout instead, and prints every count and percentage.

### Proposal

Selecting a task type filters the other charts in the same card: choosing **Video & photo** narrows the per-month column chart, the four stat tiles, and the ring to that type alone. The same pattern applies to the budget tab, where selecting a line item in **Biggest line items** would narrow **Spend by month**.

No new query and no server round trip. `MonthlyTaskCharts` already receives every entry and does its grouping in the browser, so the filter is local component state over data that is already loaded.

### Build the control on the legend rows, not the slices

Clicking the slices is the obvious design and the wrong one to build first, for three reasons:

1. On touch, a tap already means "show the tooltip". Tap-to-filter collides with it.
2. SVG arc paths are not keyboard-reachable, so a slice-only control is mouse-only and fails the accessibility bar the rest of these charts already meet.
3. A five-percent slice is roughly a fifteen-pixel target.

The legend rows are already present, already name the type in text, and become native `<button>` elements at no layout cost — keyboard-reachable, generously sized, and with room for a visible selected state. Wire those as the control, then add the slices as a mouse shortcut on top.

Whatever is built must keep a clear, visible way to return to the unfiltered view. A filtered chart that looks like an unfiltered one is worse than no filter.

### Scope boundary

Filtering stops at the card. The **Pending review** list, **Status mix**, and the three gauge tiles all count *reports*, while the task charts count *tasks*, and a single report contains several task types. "Show only Video & photo" has no coherent answer for a card whose unit is the report, so those must not be wired into the filter.

### Constraint for whoever builds this

Colour follows the entity, never its rank. Filtering the ring down to three types must not repaint the survivors. This already holds — `taskTypeColor()` resolves a type's colour from its index in `TASK_TYPES`, not from its position in the chart — and must not be replaced with rank-based assignment when the filtering is added.

Estimated at a few hours, most of it in the selected and cleared states and keyboard behaviour rather than in the filtering itself.

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

## Sign-in restriction

Only office accounts may sign in. Both the rule and the post-login redirect check live in `src/lib/login-rules.ts` so a new caller cannot reintroduce a weaker version of either.

- `ALLOWED_EMAIL_DOMAIN` is `@ocic.com.kh`. Changing offices means changing that one constant.
- The login action checks the domain **before** calling Supabase Auth, so a personal address is never attempted as a credential, and the rejection message names the required domain instead of reading as a wrong password.
- The invite action applies the same rule through a zod `.refine`, so an Admin cannot create an account that would then be unable to sign in.
- `safeNextPath` accepts only a same-origin absolute path. It rejects `//evil.com` and `/\evil.com` — browsers normalise `\` to `/` in the authority position — and anything carrying a scheme. Control characters are stripped first so a smuggled tab or newline cannot make the test disagree with what the browser eventually parses. The login page, the login action, and the proxy all route their `next` value through it.
- This is a convenience and anti-typo guard on the client path, not the security boundary. Row Level Security and the Server Action role guards remain the authority.

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
10. `0010_profile_department.sql` — adds `profiles.department`, the `user_department()` helper, and a self-update policy that pins department the way it already pins role.
11. `0011_event_marketing_department.sql` — widens the department check constraint to include Event Marketing. **Not yet applied.**
12. `0012_coordinator_budget_visibility.sql` — widens `reports: select` and `can_view_report()` so a Coordinator reads every non-draft budget report across the office. Monthly activity reports and `can_edit_report()` are untouched. **Not yet applied.**

Migrations `0001`–`0010` are confirmed applied in Supabase; `0011` and `0012` are pending. Do not delete or rewrite an applied migration; add a new numbered migration for future database changes.

## Departments

Eight departments, stored on `profiles.department`:

Digital Marketing · Multimedia · Brand Marketing · Product Marketing · KTI Marketing · Partnership Marketing · Event Marketing · Admin/HR

- **Text column with a check constraint, not an enum.** Departments are a business list that will change more often than `app_role`, and `alter type … add value` cannot always run inside a transaction block, which makes enum growth awkward under migration tooling. Widening a check constraint is a plain transactional statement.
- **The list lives in two places** — the constraint in the latest department migration and `DEPARTMENTS` in `src/lib/types.ts`. Adding one means a new migration widening the constraint *and* a line in that array; `0011` is the worked example. The ids are stored values, so renaming one orphans every profile holding it. The *display order* is free, though: nothing resolves a department by index, so a new entry can sit wherever reads best.
- **Nullable, no default.** Accounts that predate the column genuinely have no department, and back-filling everyone into one would be inventing data. Those rows read "Unassigned" until an Admin sets them.
- **Assignment is Admin-only**, enforced in three layers like the role: the Coordinator sees a read-only chip instead of a control, `updateUserDepartment` calls `requireRole("admin")`, and the RLS self-update policy pins `department` so a user cannot change their own through the API. The comparison uses `is not distinct from` rather than `=` so a NULL department compares correctly instead of making the predicate NULL and failing every self-update.
- Unlike the role, **an Admin may set their own department.** It grants no privilege, and an Admin belongs to a department the same as anyone else.

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
- `src/components/dashboard-chart-tabs.tsx` — annual budget / monthly report tab rail; both panels are rendered on the server and passed through as props.
- `src/components/annual-budget-summary.tsx` — reviewed-only annual aggregation and role-specific author scope.
- `src/components/summary-filters.tsx` — year, month, and author/Manager selects, shared by both tabs through the `yearParam`/`monthParam`/`authorParam`/`idPrefix` props. The month select only renders when a tab passes months.
- `src/components/monthly-task-summary.tsx` — reviewed-only task aggregation, month resolution, and role-specific author scope.
- `src/components/monthly-task-charts.tsx` — task mix donut, the month's task list, and the activity trend line.
- `src/components/reports-table.tsx` — report list, accessible Admin selection controls, and bulk-delete confirmation.
- `src/components/department-badge.tsx` — the one department chip, used everywhere a department appears.
- `src/components/report-form.tsx` — activity/budget form, historical structure reuse, calculations, and serialization.
- `src/app/(app)/reports/actions.ts` — save, submit, delete, review, comment, and attachment actions.
- `src/app/(app)/reports/[id]/page.tsx` — detail view and review-control visibility.
- `src/app/(app)/admin/users/page.tsx` — Admin/Coordinator user list with role-specific controls.
- `src/app/(app)/admin/users/actions.ts` — invite, role change, department change, password reset, and deletion authorization.
- `src/lib/login-rules.ts` — the office-domain rule and the post-login redirect check, shared by the login page, the login action, the invite action, and the proxy.
- `src/lib/auth.ts` — centralized role guards and permission helpers, including `isReviewer()` / `seesOtherAuthors()` (deliberately different questions) and `annualBudgetScope()`.
- `src/lib/types.ts` — roles, reports, budget periods, month keys, the `TASK_TYPES` taxonomy, and shared data types.
- `src/app/globals.css` — brand theme, the validated `--series-1…6` / `--series-neutral` chart palette, and the `--department*` chip tokens, all defined for both themes. The stock `--chart-N` slots remain for the generated components but no chart draws with them.
- `src/lib/supabase/` — browser, authenticated server, and secret Admin clients.
- `src/proxy.ts` — Supabase session refresh and login redirects.
- `supabase/migrations/` — ordered schema and security history.

## Deployment state

- GitHub repository: `muni-the-goat/OCIC-MCD-Managment`
- Deployed branch: `main`
- Hosting: Vercel, connected for automatic deployment from GitHub
- Database: Supabase, migrations `0001`–`0010` applied; `0011` and `0012` pending
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
10a. After `0012`, confirm a Coordinator sees every non-draft budget report on the Reports page and every author in the annual summary, sees no one else's monthly activity report, sees no drafts, and has no Edit, Delete, Mark reviewed, or Reject control on a report they did not author.
11. Confirm a reviewed monthly budget enters the correct annual-summary month while draft, submitted, and rejected budgets stay excluded.
12. Confirm a new monthly budget reuses the nearest earlier section/item structure but leaves current amounts empty.

## Known limitations and future options

- `profiles.department` is **displayed but never queried**. Every surface that names an author now prints their department beside it, and no query filters, scopes, or groups by it. Annual budget visibility still uses the Manager author account as the department boundary. Wiring it into queries — a Head of Department seeing their own department rather than all Managers, a department filter on the dashboard summaries, department subtotals in the annual budget — is the obvious next step and needs no further schema work.
- The author filter dropdowns on both dashboard tabs still list names only. Adding the department would disambiguate two people who share a first name, but it risks truncating inside the select's width and wants a two-line item rather than a longer single line.
- Annual aggregation matches normalized text names; it does not use permanent line-item IDs. Historical structure reuse reduces spelling drift, but a future canonical expense-category table would provide stronger guarantees.
- One pre-existing July 2026 author/period contains three reviewed reports. The uniqueness trigger deliberately preserves them. After deciding which record is canonical, the duplicates can be reconciled and the trigger can later be upgraded to a partial unique index.
- Supabase is hosted in Seoul while users are primarily closer to Southeast Asia, which can add network latency. Moving regions requires creating a new project and migrating data/configuration.
- The project is stored inside OneDrive, which can slow local dependency operations or cause file locks.
- The next planned work is the Marketing Communication alignment (Phases 1 and 2) and chart cross-filtering (Phase 3), all described above.
- Possible future phases beyond it: departments/teams, canonical budget categories, notifications, audit logs, and Excel/PDF export. Export is worth reconsidering once Phase 1 lands, because the team still hand-assembles the PDF that the application would then hold all the data for.

## Local environment notes

- Node.js: v22.14.0
- npm: 10.9.2
- Next.js: 16.2.10
- Next.js 16 uses `src/proxy.ts` instead of middleware and treats `cookies()`, `params`, and `searchParams` as async APIs.
- `turbopack.root` is pinned in `next.config.ts` because another `package-lock.json` exists at `Desktop\Web3\package-lock.json`.
- If local installs or builds become slow, pause OneDrive sync or exclude this project directory.
