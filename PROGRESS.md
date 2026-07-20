# MCD Management — Build Progress & Handoff Notes

Internal office report tracker (CMS-style): staff submit **monthly or annual budget reports** and **monthly activity reports** through structured forms with file attachments, flowing through a **draft → submitted → reviewed/rejected** workflow, with **Admin / Head of Department / Manager / Staff** role-based access.

## Status: ✅ Monthly budget workflow and automatic annual dashboard complete

All application code is written and `npm run build` + ESLint pass. What was built:

1. **Database migrations** — `supabase/migrations/0001_init.sql` creates the schema, RLS, storage policies, and profile trigger; `0002_rename_approved_to_reviewed.sql` renames the terminal positive status; `0003_budget_monthly_grid.sql` adds the section/item Jan–Dec actual-expense grid; `0004_security_hardening.sql` prevents role injection and makes review decisions transactional; `0005_budget_period.sql` adds independent monthly and annual budget periods; `0006_head_of_department_role.sql` adds the HoD role and HoD-only positive approval
2. **Auth** — `src/lib/supabase/{client,server,admin}.ts`, `src/proxy.ts` (session refresh + login redirects with `?next=`), `/login` page + login/logout actions
3. **App shell** — `(app)` layout with role-aware sidebar (`src/components/app-nav.tsx`)
4. **Reports** — list w/ filters (type/status/author-for-reviewers), new (type picker → form), edit, detail; all new budget reports use the one-month amount layout with freeform sections and subtotals; legacy annual records remain readable/editable; monthly activity reports have 4 section textareas; all server actions live in `src/app/(app)/reports/actions.ts`
5. **Attachments** — uploaded inside the save action (bodySizeLimit 20mb, 15 MB/file), downloads via `/api/attachments/[id]` → signed URL redirect, delete on detail page
6. **Review workflow** — only the Head of Department can mark submitted reports reviewed; managers/admins/HoD can reject with a required comment; no self-review; comments thread included
7. **Admin users** — `/admin/users`: invite via service-role `createUser` with generated temp password (shown once, no SMTP needed), role select (can't change own), password reset, delete user
8. **Dashboard** — role-aware stat cards + recent reports (pending-review queue for managers/admins/HoD), plus a streamed annual Jan–Dec budget summary generated only from reviewed monthly budgets with year/author filters
9. **Docs** — README with full setup steps, `.env.example` (un-ignored in `.gitignore`)

## ⏭️ Next steps (user-driven)

1. Deploy the current update, assign the intended reviewer the Head of Department role, and verify submit → HoD review and manager/admin rejection
2. Verify that a reviewed monthly budget appears in the correct month of the dashboard annual summary and that drafts/submitted/rejected budgets do not
3. Possible later phases: annual aggregation from reviewed monthly budgets, email notifications, analytics, departments/teams, and Excel/PDF export

## Environment / gotchas

- Node v22.14.0, npm 10.9.2 ✔; Next.js 16.2.10 — **middleware is renamed `proxy.ts`**, request APIs (`cookies()`, `params`, `searchParams`) are async-only
- A stray `package-lock.json` exists at `Desktop\Web3\package-lock.json`; `turbopack.root` is pinned in `next.config.ts` to silence the warning
- Project is inside **OneDrive** — if installs/dev get slow or lock up, exclude the folder from sync
