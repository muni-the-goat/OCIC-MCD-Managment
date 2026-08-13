# MCD Management — System Overview

An internal web application for OCIC's Marketing Communication Department (MCD).
It replaces spreadsheets emailed around the office with one place where staff file
monthly reports, managers review them, and leadership sees the numbers roll up.

---

## What it does

**Two sides of the office, deliberately separated.**

### 1. MCD reporting (the marketing department)

Staff file two kinds of report each month:

| Report | Contains |
|---|---|
| **Monthly budget report** | Actual expenses for one month, grouped into freeform sections and line items, on a Jan–Dec grid |
| **Monthly activity report** | Summary, accomplishments, challenges, next-month plan, plus attached documents |

Every report moves through one lifecycle:

```
draft → submitted → reviewed          (approved)
draft → submitted → rejected → edited → resubmitted
reviewed → edited → submitted → reviewed again   (correction)
```

Reports carry comments and private file attachments. **Only reviewed monthly
budgets** feed the annual Jan–Dec dashboard — drafts, submissions and rejections
never affect the totals. The Head of Department sets the approved annual budget
figure, which becomes the denominator for "% of budget" on the dashboard.

### 2. Project reporting (the Vice President's side)

Sales, leasing and property management performance across OCIC's projects
(Koh Pich, Chroy Changvar Bay), each year compared against the one before.
Every unit is filed under one of four fixed headings — Land, House, Condo,
Commercial — with a running "Unassigned" group for units nobody has filed yet.
Sales tracks units *and* amounts; the other two track amounts only.

The two sides do not read each other. A Vice President sees no MCD report; a
Head of Department sees no project report. Only an Admin sees both.

---

## Roles

Seven roles, most senior first. Seniority governs *account management*;
capability is defined separately, and the two deliberately come apart.

| Role | Shape of the job |
|---|---|
| **Admin** | Runs the system. Unrestricted, except they cannot set the approved annual budget |
| **Vice President** | Projects side + account management. Reads no MCD report |
| **Head of Department** | Admin-equivalent on MCD reports and accounts, except cannot reset passwords. The only role that sets the approved annual budget |
| **VP Assistant** | Compiles the three project reports. Nothing else — no MCD reports, no Users page |
| **Coordinator** | Reads every non-draft *budget* report office-wide and may approve (never reject). Can reset non-privileged passwords |
| **Manager** | Sees only their own reports and their own expenses. Read-only Users page |
| **Staff** | Creates, edits and submits their own reports; comments on them |

Approving and rejecting are two separate permissions. Rejection creates work for
someone else, so it stays with Admin, Vice President and Head of Department.

`src/lib/roles.ts` is the single written statement of this policy, with the
reasoning for each carve-out in comments. `PROGRESS.md` holds the longer history.

---

## Architecture

```
Browser
   │
   ▼
Next.js 16 (App Router, React 19, Turbopack)  ── Vercel
   │  src/proxy.ts  → session refresh + auth redirects on every request
   │  Server Components  → read data directly with the user's session
   │  Server Actions     → all writes (save, submit, review, invite, upload)
   ▼
Supabase
   ├── Auth      email + password, @ocic.com.kh only, no self sign-up
   ├── Postgres  tables + Row Level Security
   └── Storage   private `attachments` bucket, served via short-lived signed URLs
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Recharts · Zod · Supabase (`@supabase/ssr`).

### Security model

Access is enforced in **three independent layers**, so hiding a button is never
the boundary:

1. **Row Level Security** in Postgres — the last word. Even a direct API call
   with a user's token only sees what their role's policies allow.
2. **Server Actions and page guards** — every write re-checks the role
   server-side against the *target's* current role, read from the database.
3. **UI** — controls the user cannot use are hidden or disabled, as presentation
   over an already-enforced rule.

Two guards keep the privileged tier from escalating: a Head of Department or
Vice President can neither grant the Admin role nor modify an Admin account.

Other protections:

- **Sign-in throttle** — 8 failed attempts per email + IP in 15 minutes locks
  sign-in and tells the person to ask for a reset (`login_attempts`, written only
  by the service-role key).
- **Attachments** are never public. `/api/attachments/[id]` checks the session,
  then redirects to a 60-second signed URL.
- **Role is not self-editable** — the profile update policy blocks role and
  department changes by the account itself.
- The service-role key (`SUPABASE_SECRET_KEY`) is server-only and used solely for
  admin user management and the login throttle.

### Data model

| Table | Holds |
|---|---|
| `profiles` | One row per account: name, email, role, department. Created by trigger on sign-up |
| `departments` | The department list; an Admin or HoD can add rows |
| `reports` | Both report types, with status, period, and activity prose in a `content` jsonb column |
| `budget_items` | Line items under a report, one row per item with `m01`–`m12` amounts |
| `report_comments` / `report_attachments` | Review discussion and uploaded files |
| `budget_approvals` | The approved annual budget, one row per fiscal year |
| `projects` | Koh Pich, Chroy Changvar Bay |
| `project_reports` / `project_report_items` | Per project, stream and year, with `m01`–`m12` amounts and `u01`–`u12` units |
| `login_attempts` | Failed sign-ins, for the throttle |

A month with no figures is treated as **unreported**, not as a month where
nothing happened — the two must never look the same on a chart.

### Code layout

```
src/proxy.ts                 session refresh + auth redirects (Next 16 renamed middleware → proxy)
src/lib/roles.ts             the permission policy, pure and importable by client code
src/lib/auth.ts              session reader + role guards (server only)
src/lib/types.ts             domain types, labels, month/unit keys, totals
src/lib/supabase/            browser / server / service-role clients
src/app/(app)/               the authenticated app
  dashboard/                 MCD dashboard: pending queue, status mix, annual summary
  reports/                   list, create, view, edit, review
  projects/                  the VP side: streams, per-project dashboard, monthly entry
  admin/users/               invite, roles, departments, password resets
  profile/                   own details and password change
src/app/api/attachments/[id] signed-URL download redirect
supabase/migrations/         ordered schema; every one already applied in production
```

---

## Day-to-day use

1. An **Admin** creates the account from the Users page; it hands back a
   temporary password to give the person (no email/SMTP required).
2. **Staff** open *New report*, pick the month, and fill in the budget grid or the
   activity write-up. A new monthly budget pre-fills its section and line-item
   names from that author's previous month, with the amounts left blank.
3. They **submit**. It appears in the reviewer's pending queue on the dashboard.
4. A **reviewer** opens it, comments if needed, then marks it reviewed or rejects
   it with required feedback.
5. Once reviewed, the budget's figures appear in the **annual Jan–Dec summary**,
   the department × month matrix, and the charts. Any later edit clears the
   approval and requires a fresh review before the numbers count again.
6. **Reports print** — both the budget report and the project report have a PDF
   export built for handing to leadership.

## Operating notes

- Each author may file one monthly budget per month; corrections are edits, not
  new reports.
- Attachments: 15 MB per file (request limit raised to 20 MB in `next.config.ts`).
- Sign-in is restricted to `@ocic.com.kh` addresses, and self sign-up is off in
  Supabase — accounts exist only because an administrator made them.
- Setup, environment variables and the full migration list are in [README.md](README.md).
- The reasoning behind every role carve-out and design decision is in [PROGRESS.md](PROGRESS.md).
