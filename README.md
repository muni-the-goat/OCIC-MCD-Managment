# MCD Management

Internal office report tracker. Staff submit **budget reports** (separate monthly actual expenses or a full-year Jan–Dec grid) and **monthly activity reports** (structured narrative sections) with file attachments, flowing through a **draft → submitted → reviewed/rejected** workflow with **Admin / Manager / Staff** roles.

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

Every other account can then be created from the app's **Users** page (admin only) — it creates the account with a temporary password to hand to the person, so no SMTP setup is needed.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

## Roles

| Role | Can do |
|---|---|
| **Staff** | Create/edit own drafts, submit for review, edit & resubmit rejected reports, comment on own reports |
| **Manager** | Everything staff can, plus: see all non-draft reports, mark another author's submitted reports reviewed or rejected (comment required on reject) |
| **Admin** | Everything, plus user management (invite, roles, password resets) and editing/deleting any report |

Access control is enforced by Postgres Row Level Security, not just the UI — direct API calls with a user's JWT hit the same policies.

## Project layout

- `supabase/migrations/` — ordered database schema, workflow, budget-grid, and security migrations
- `src/proxy.ts` — session refresh + auth redirects (Next 16 renamed middleware → proxy)
- `src/lib/supabase/` — browser / server / service-role Supabase clients
- `src/app/(app)/` — authenticated app (dashboard, reports, admin)
- `src/app/(app)/reports/actions.ts` — report save/submit, review, comment, attachment server actions
- `src/app/api/attachments/[id]/route.ts` — signed-URL download redirect

## Notes

- Attachment uploads go through server actions; the request body limit is raised to 20 MB in `next.config.ts` (individual files capped at 15 MB in the action).
- The project folder living inside OneDrive can cause slow installs / file-lock errors — exclude it from sync if `npm` misbehaves.
