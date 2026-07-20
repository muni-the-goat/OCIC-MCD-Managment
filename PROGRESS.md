# MCD Management — Build Progress & Handoff Notes

Internal office report tracker (CMS-style): staff submit **budget reports** and **monthly reports** through structured forms with file attachments, flowing through a **draft → submitted → reviewed/rejected** workflow, with **Admin / Manager / Staff** role-based access.

## Status: ✅ Code complete — awaiting Supabase setup

All application code is written and `npm run build` + ESLint pass. What was built:

1. **Database migrations** — `supabase/migrations/0001_init.sql` creates the schema, RLS, storage policies, and profile trigger; `0002_rename_approved_to_reviewed.sql` renames the terminal positive status; `0003_budget_monthly_grid.sql` adds the section/item Jan–Dec actual-expense grid; `0004_security_hardening.sql` prevents role injection and makes review decisions transactional
2. **Auth** — `src/lib/supabase/{client,server,admin}.ts`, `src/proxy.ts` (session refresh + login redirects with `?next=`), `/login` page + login/logout actions
3. **App shell** — `(app)` layout with role-aware sidebar (`src/components/app-nav.tsx`)
4. **Reports** — list w/ filters (type/status/author-for-reviewers), new (type picker → form), edit, detail; budget reports use a full-year Jan–Dec actual-expense grid with freeform sections and subtotals, monthly reports have 4 section textareas; all server actions live in `src/app/(app)/reports/actions.ts`
5. **Attachments** — uploaded inside the save action (bodySizeLimit 20mb, 15 MB/file), downloads via `/api/attachments/[id]` → signed URL redirect, delete on detail page
6. **Review workflow** — review/reject (comment required on reject), no self-review, and a comments thread
7. **Admin users** — `/admin/users`: invite via service-role `createUser` with generated temp password (shown once, no SMTP needed), role select (can't change own), password reset, delete user
8. **Dashboard** — role-aware stat cards + recent reports (pending-review queue for managers/admins)
9. **Docs** — README with full setup steps, `.env.example` (un-ignored in `.gitignore`)

## ⏭️ Next steps (user-driven)

1. **User**: create a free Supabase project, disable public email signup, run migrations `0001` → `0002` → `0003` → `0004` in the SQL editor, copy `.env.example` → `.env.local` with real keys, bootstrap first admin (steps in README)
2. Then: `npm run dev` and walk the verification script from the plan (staff submit → manager reject → resubmit → review; RLS cross-user test; admin invite)
3. Possible later phases: email notifications, analytics over `budget_items`, departments/teams, Excel/PDF export, Vercel deploy

## Environment / gotchas

- Node v22.14.0, npm 10.9.2 ✔; Next.js 16.2.10 — **middleware is renamed `proxy.ts`**, request APIs (`cookies()`, `params`, `searchParams`) are async-only
- A stray `package-lock.json` exists at `Desktop\Web3\package-lock.json`; `turbopack.root` is pinned in `next.config.ts` to silence the warning
- Project is inside **OneDrive** — if installs/dev get slow or lock up, exclude the folder from sync
