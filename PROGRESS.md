# MCD Management — Build Progress & Handoff Notes

Internal office report tracker (CMS-style): staff submit **monthly budget reports** and **monthly activity reports** through structured forms with file attachments, flowing through a **draft → submitted → reviewed/rejected** workflow, with **Admin / Head of Department / Coordinator / Manager / Staff** role-based access.

## Status: ✅ Monthly budget workflow and automatic annual dashboard complete

All application code is written and `npm run build` + ESLint pass. What was built:

1. **Database migrations** — `supabase/migrations/0001_init.sql` creates the schema, RLS, storage policies, and profile trigger; `0002_rename_approved_to_reviewed.sql` renames the terminal positive status; `0003_budget_monthly_grid.sql` adds the section/item Jan–Dec actual-expense grid; `0004_security_hardening.sql` prevents role injection and makes review decisions transactional; `0005_budget_period.sql` adds independent monthly and annual budget periods; `0006_head_of_department_role.sql` adds the HoD role; `0007_coordinator_and_admin_review.sql` adds the Coordinator role and permits Admin/HoD positive approval
2. **Auth** — `src/lib/supabase/{client,server,admin}.ts`, `src/proxy.ts` (session refresh + login redirects with `?next=`), `/login` page + login/logout actions
3. **App shell** — `(app)` layout with role-aware sidebar (`src/components/app-nav.tsx`)
4. **Reports** — list w/ filters (type/status/author-for-reviewers), new (type picker → form), edit, detail; all new budget reports use the one-month amount layout with freeform sections and subtotals; the latest earlier monthly budget automatically supplies consistent section/item names and reference amounts without copying spend; legacy annual records remain readable/editable; monthly activity reports have 4 section textareas; all server actions live in `src/app/(app)/reports/actions.ts`
5. **Attachments** — uploaded inside the save action (bodySizeLimit 20mb, 15 MB/file), downloads via `/api/attachments/[id]` → signed URL redirect, delete on detail page
6. **Review workflow** — Admins and the Head of Department can mark submitted reports reviewed; managers/admins/HoD can reject with a required comment; no self-review; comments thread included
7. **Users** — `/admin/users`: Admins can invite via service-role `createUser`, assign roles, reset passwords, and delete users; Coordinators can view users and reset non-privileged passwords only
8. **Dashboard** — role-aware stat cards + recent reports (pending-review queue for managers/admins/HoD), plus a streamed annual Jan–Dec budget summary generated only from reviewed monthly budgets with year/author filters
9. **Docs** — README with full setup steps, `.env.example` (un-ignored in `.gitignore`)

## ⏭️ Next steps (user-driven)

1. Apply `0007_coordinator_and_admin_review.sql`, assign a Coordinator, and verify Admin/HoD review permissions
2. Verify that a Coordinator can view users and reset an eligible password, but cannot invite, change roles, delete users, or reset Admin/HoD passwords
3. Verify that a reviewed monthly budget appears in the correct month of the dashboard annual summary and that drafts/submitted/rejected budgets do not
4. Verify that a new month reuses the previous month's section/item names while keeping the new amount inputs empty
5. Possible later phases: email notifications, analytics, departments/teams, and Excel/PDF export

## Environment / gotchas

- Node v22.14.0, npm 10.9.2 ✔; Next.js 16.2.10 — **middleware is renamed `proxy.ts`**, request APIs (`cookies()`, `params`, `searchParams`) are async-only
- A stray `package-lock.json` exists at `Desktop\Web3\package-lock.json`; `turbopack.root` is pinned in `next.config.ts` to silence the warning
- Project is inside **OneDrive** — if installs/dev get slow or lock up, exclude the folder from sync
