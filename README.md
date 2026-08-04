# MCD Management

Internal office report tracker. Staff submit **monthly budget reports** and **monthly activity reports** with file attachments, flowing through a **draft → submitted → reviewed/rejected** workflow. Reviewed monthly budgets automatically roll up into the Jan–Dec annual dashboard. Access is controlled through **Admin / Vice President / Head of Department / VP Assistant / Coordinator / Manager / Staff** roles.

Built with Next.js 16 (App Router) + Supabase (Auth, Postgres with Row Level Security, Storage) + Tailwind v4 + shadcn/ui.

## Setup

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free tier is fine) and create a new project.
2. Go to **Authentication → Sign In / Providers → Email** and turn off **Allow new users to sign up**. Accounts for this internal app must be created by an administrator.
3. In the dashboard, go to **SQL Editor** and run these migrations in order:
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — initial tables, roles, RLS policies, private storage bucket, and profile trigger
   2. [`supabase/migrations/0002_rename_approved_to_reviewed.sql`](supabase/migrations/0002_rename_approved_to_reviewed.sql) — renames the positive terminal status to `reviewed`
   3. [`supabase/migrations/0003_budget_monthly_grid.sql`](supabase/migrations/0003_budget_monthly_grid.sql) — changes budget line items into the Jan–Dec actual-expense grid
   4. [`supabase/migrations/0004_security_hardening.sql`](supabase/migrations/0004_security_hardening.sql) — prevents role injection and makes review decisions transactional
   5. [`supabase/migrations/0005_budget_period.sql`](supabase/migrations/0005_budget_period.sql) — adds separate monthly and annual budget report periods while preserving existing reports as annual
   6. [`supabase/migrations/0006_head_of_department_role.sql`](supabase/migrations/0006_head_of_department_role.sql) — adds the Head of Department role and restricts positive review approval to that role
   7. [`supabase/migrations/0007_coordinator_and_admin_review.sql`](supabase/migrations/0007_coordinator_and_admin_review.sql) — adds the Coordinator role and allows Admins or the Head of Department to mark reports reviewed
   8. [`supabase/migrations/0008_admin_self_review.sql`](supabase/migrations/0008_admin_self_review.sql) — gives Admins unrestricted review authority, including for their own submitted reports
   9. [`supabase/migrations/0009_monthly_budget_uniqueness_and_revisions.sql`](supabase/migrations/0009_monthly_budget_uniqueness_and_revisions.sql) — blocks new duplicate author/month budgets and lets authors revise submitted or reviewed reports for re-review
   10. [`supabase/migrations/0010_profile_department.sql`](supabase/migrations/0010_profile_department.sql) — adds `profiles.department` and pins it against self-service changes
   11. [`supabase/migrations/0011_event_marketing_department.sql`](supabase/migrations/0011_event_marketing_department.sql) — adds Event Marketing to the department list
   12. [`supabase/migrations/0012_coordinator_budget_visibility.sql`](supabase/migrations/0012_coordinator_budget_visibility.sql) — lets a Coordinator read every non-draft budget report across the office
   13. [`supabase/migrations/0013_departments_table_and_role_powers.sql`](supabase/migrations/0013_departments_table_and_role_powers.sql) — turns departments into a table, narrows a Manager to their own reports, and makes Head of Department admin-equivalent
   14. [`supabase/migrations/0014_coordinator_review.sql`](supabase/migrations/0014_coordinator_review.sql) — splits approving from rejecting; a Coordinator may approve but never reject
   15. [`supabase/migrations/0015_budget_approval.sql`](supabase/migrations/0015_budget_approval.sql) — adds the approved annual budget figure, one row per fiscal year
   16. [`supabase/migrations/0016_allow_multiple_monthly_budgets.sql`](supabase/migrations/0016_allow_multiple_monthly_budgets.sql) — allows more than one monthly budget report per author, month, and year
   17. [`supabase/migrations/0017_vice_president_roles.sql`](supabase/migrations/0017_vice_president_roles.sql) — adds the Vice President and VP Assistant roles, and replaces the hand-copied privileged-role lists with `public.is_privileged()`
   18. [`supabase/migrations/0018_project_reports.sql`](supabase/migrations/0018_project_reports.sql) — adds the project reports (sales, leasing, property management), narrows the VP Assistant to that side, and seeds the 2025–2026 Jan–June figures
   19. [`supabase/migrations/0019_vice_president_projects_only.sql`](supabase/migrations/0019_vice_president_projects_only.sql) — takes the MCD reports and the budget approval from the Vice President, leaving them the projects side plus account management
   20. [`supabase/migrations/0020_projects_dimension.sql`](supabase/migrations/0020_projects_dimension.sql) — makes projects a table (Koh Pich, Chroy Changvar Bay) and keys every project report to one
   21. [`supabase/migrations/0021_chroy_changvar_bay.sql`](supabase/migrations/0021_chroy_changvar_bay.sql) — seeds Chroy Changvar Bay's 2025–2026 sales and leasing figures

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values from **Project Settings → API Keys** in your Supabase dashboard:

- `NEXT_PUBLIC_SUPABASE_URL` — the Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key (`sb_publishable_...`)
- `SUPABASE_SECRET_KEY` — the secret key (`sb_secret_...`; server-only, used for the admin user-management page)

### 3. Bootstrap the first admin

1. In the Supabase dashboard: **Authentication → Users → Add user** — enter your email + password and check **Auto Confirm User**.
2. In the **SQL Editor**, run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

Every other account can then be created by an Admin from the app's **Users** page. It creates the account with a temporary password to hand to the person, so no SMTP setup is needed. Coordinators can access the same page to view users and reset eligible passwords, but cannot create or delete accounts or change roles.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

## Roles

Least senior first. Each row assumes the report-authoring capabilities of **Staff**.

| Role | Can do |
|---|---|
| **Staff** | Create reports, edit any report they authored, submit revisions for review, and comment on their reports; revising a reviewed report requires a new review |
| **Manager** | Sees only their own reports, and only their own reviewed expenses in the annual summary; can open the Users page read-only |
| **Coordinator** | Reads every non-draft **budget** report across the office and may mark one reviewed, including their own; cannot reject anything, and sees no one else's activity reports. Can open the Users page and reset non-privileged passwords; cannot invite, change roles, delete users, or add a department |
| **VP Assistant** | The same Projects side as the Vice President, without account management. Compiles and edits the three project reports and sees nothing else — no MCD reports, no dashboard, no Users page |
| **Head of Department** | Admin-equivalent on MCD reports and accounts, with one exception: cannot reset a password. The only role that sets the approved annual budget. Does not see the Projects side |
| **Vice President** | Lives on the **Projects** side: sales, leasing and property management across OCIC's projects, each year against the one before. Files the project monthly report. Still manages accounts, but reads no MCD report and no longer sets the approved annual budget |
| **Admin** | Unrestricted user and report management, including bulk report deletion and full review authority. The only role that can grant Admin or reset any password, and the only one that **cannot** set the approved annual budget |

Access control is enforced by server-side role guards and Postgres Row Level Security, not just by hidden UI controls. `src/lib/roles.ts` is the single statement of the policy; `PROGRESS.md` explains the reasoning behind each carve-out.

## Project layout

- `supabase/migrations/` — ordered database schema, workflow, budget-grid, and security migrations
- `src/proxy.ts` — session refresh + auth redirects (Next 16 renamed middleware → proxy)
- `src/lib/supabase/` — browser / server / service-role Supabase clients
- `src/app/(app)/` — authenticated app (dashboard, reports, admin)
- `src/app/(app)/reports/actions.ts` — report save/submit, review, comment, attachment server actions
- `src/app/api/attachments/[id]/route.ts` — signed-URL download redirect

## Notes

- Attachment uploads go through server actions; the request body limit is raised to 20 MB in `next.config.ts` (individual files capped at 15 MB in the action).
- New budget reports are monthly-only. The dashboard annual summary groups matching section and line-item names and sums every reviewed monthly budget into its corresponding Jan–Dec column.
- Each author may create only one monthly budget per month/year. Existing submitted or reviewed budgets must be edited; saving a revision removes the old approval and submitting it starts a new review cycle.
- Annual-summary visibility is role-scoped: Managers see only their own reviewed expenses, the Head of Department sees and filters all Managers, and Admins remain unrestricted. The all-author view separates expenses into grids labeled with each author's name. Staff and Coordinators do not receive the annual summary.
- A new monthly budget automatically reuses section and line-item names from the user's most recent earlier monthly budget. Previous amounts are shown as reference only; the new month's amounts start empty.
- Annual budget records created before the monthly-only workflow remain available as historical reports.
- The project folder living inside OneDrive can cause slow installs / file-lock errors — exclude it from sync if `npm` misbehaves.
