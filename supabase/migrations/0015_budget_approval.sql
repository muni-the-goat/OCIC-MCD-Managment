-- The approved annual budget the team measures spend against. It is the
-- "Budget Approval: $150,000.00" line at the top of their Actual Expenses
-- workbook, and the denominator behind that sheet's Percentage column.
--
-- A table keyed by year, not a constant: the figure is re-approved every year,
-- and hardcoding it would make January a code change.
--
-- One office-wide figure, not one per department. That is what the workbook
-- holds, and a per-department split would need the org to actually allocate
-- that way before the app can claim it does. If that changes, add a nullable
-- department column and treat NULL as the office-wide total.

create table if not exists public.budget_approvals (
  year int primary key check (year between 2000 and 2100),
  amount numeric(14, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- FY2026, from the workbook.
insert into public.budget_approvals (year, amount)
values (2026, 150000.00)
on conflict (year) do nothing;

alter table public.budget_approvals enable row level security;

-- Readable by anyone signed in; the dashboard decides who is shown it. Writes
-- go through the service-role admin client behind a role guard, so there is
-- deliberately no write policy here.
drop policy if exists "budget_approvals: read all" on public.budget_approvals;
create policy "budget_approvals: read all" on public.budget_approvals
  for select to authenticated
  using (true);
