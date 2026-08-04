-- The Vice President's side of the office.
--
-- Everything in this application until now has been the Marketing Communication
-- Department reporting on its own spend and activity. These three reports are a
-- different subject entirely: what OCIC's projects earned. Sales of land, houses
-- and condos; leasing income per property; property management income per
-- property. Koh Pich, Airway Complex, KSP and Cross Department, compiled monthly
-- and read year against year.
--
-- Modelled on budget_items rather than sharing it. The shape is nearly the same
-- — named rows, twelve monthly figures — but departmental spend and project
-- revenue are different domains with different authors, different readers and
-- different lifecycles, and one table serving both would make every future
-- change to one a risk to the other.
--
-- Three differences from a budget report, each of which is why this table exists:
--
--   1. A unit count beside every amount. "11 condos for $791,807" is the sales
--      report's actual content; an amount alone loses half of it. Only the sales
--      stream fills these; leasing and property management leave them at zero.
--   2. No review workflow. These are recorded facts, not work someone approves —
--      nobody rejects what June's leasing income was. There is no status column
--      and no reviewer, which is the whole reason they are not `reports`.
--   3. One report per stream per year, not one per author. Two people filing
--      "Leasing 2026" would be two halves of one truth, so the uniqueness
--      constraint makes that impossible rather than merely discouraged.
--
-- Totals are never stored, only computed. That is not a preference: the source
-- workbook's April 2025 property-management row totals $193,603.87 against
-- components summing to $193,608.87, and the Jan–June summary silently used the
-- correct figure — so the sheet disagrees with itself by five dollars. Seeding
-- the components and computing every total makes that class of error
-- unrepresentable. The seeded data below is the components; the $5 is gone.

-- No `create type if not exists` exists in Postgres, and these migrations are
-- pasted into the SQL editor by hand, so a second run must not blow up on the
-- first statement.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'project_stream' and n.nspname = 'public'
  ) then
    create type public.project_stream as enum (
      'sales',
      'leasing',
      'property_management'
    );
  end if;
end
$$;

create table if not exists public.project_reports (
  id uuid primary key default gen_random_uuid(),
  stream public.project_stream not null,
  period_year int not null check (period_year between 2000 and 2100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One truth per stream per year. See note 3 above.
  unique (stream, period_year)
);

create table if not exists public.project_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.project_reports (id) on delete cascade,
  -- 'Land' / 'House' / 'Condo' for sales; a property name for the other two.
  -- Held per report rather than in a shared list, so a property that opens
  -- mid-year appears in the year it opened and not retroactively in earlier
  -- ones. Connexion Hub is exactly that case.
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order int not null default 100,
  m01 numeric(14, 2) not null default 0,
  m02 numeric(14, 2) not null default 0,
  m03 numeric(14, 2) not null default 0,
  m04 numeric(14, 2) not null default 0,
  m05 numeric(14, 2) not null default 0,
  m06 numeric(14, 2) not null default 0,
  m07 numeric(14, 2) not null default 0,
  m08 numeric(14, 2) not null default 0,
  m09 numeric(14, 2) not null default 0,
  m10 numeric(14, 2) not null default 0,
  m11 numeric(14, 2) not null default 0,
  m12 numeric(14, 2) not null default 0,
  -- Unit counts, sales stream only. Zero everywhere else, which is honest: a
  -- leasing month has no unit count, and NULL would invite a sum that silently
  -- skips rows.
  u01 int not null default 0 check (u01 >= 0),
  u02 int not null default 0 check (u02 >= 0),
  u03 int not null default 0 check (u03 >= 0),
  u04 int not null default 0 check (u04 >= 0),
  u05 int not null default 0 check (u05 >= 0),
  u06 int not null default 0 check (u06 >= 0),
  u07 int not null default 0 check (u07 >= 0),
  u08 int not null default 0 check (u08 >= 0),
  u09 int not null default 0 check (u09 >= 0),
  u10 int not null default 0 check (u10 >= 0),
  u11 int not null default 0 check (u11 >= 0),
  u12 int not null default 0 check (u12 >= 0),
  unique (report_id, name)
);

create index if not exists project_report_items_report_idx
  on public.project_report_items (report_id);

create index if not exists project_reports_stream_year_idx
  on public.project_reports (stream, period_year desc);

drop trigger if exists project_reports_updated_at on public.project_reports;
create trigger project_reports_updated_at
  before update on public.project_reports
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Who may read and write
-- ===========================================================================

-- Reads the project reports. The privileged tier plus the VP Assistant, whose
-- entire job these are.
create or replace function public.reads_project_reports()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_privileged()
      or coalesce(public.user_role()::text, '') = 'vp_assistant';
$$;

grant execute on function public.reads_project_reports() to authenticated;

-- Writes them. The VP Assistant compiles the figures; the Vice President and an
-- Admin can correct them. A Head of Department is deliberately absent: they are
-- admin-equivalent over the *marketing department's* reporting, which is not
-- what this is.
create or replace function public.writes_project_reports()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.user_role()::text, '') in (
    'admin',
    'vice_president',
    'vp_assistant'
  );
$$;

grant execute on function public.writes_project_reports() to authenticated;

alter table public.project_reports enable row level security;
alter table public.project_report_items enable row level security;

drop policy if exists "project_reports: read" on public.project_reports;
create policy "project_reports: read" on public.project_reports
  for select to authenticated
  using (public.reads_project_reports());

drop policy if exists "project_reports: write" on public.project_reports;
create policy "project_reports: write" on public.project_reports
  for all to authenticated
  using (public.writes_project_reports())
  with check (public.writes_project_reports());

drop policy if exists "project_report_items: read" on public.project_report_items;
create policy "project_report_items: read" on public.project_report_items
  for select to authenticated
  using (public.reads_project_reports());

drop policy if exists "project_report_items: write" on public.project_report_items;
create policy "project_report_items: write" on public.project_report_items
  for all to authenticated
  using (public.writes_project_reports())
  with check (public.writes_project_reports());

-- ===========================================================================
-- The VP Assistant narrows to the projects side
--
-- Migration 0017 gave them every non-draft report in the office. The role has
-- since been defined more precisely: they compile the project reports and read
-- nothing else. This removes the marketing-wide read that 0017 granted, leaving
-- the clause exactly as it was for a Coordinator.
--
-- Their own authored reports stay visible through the author_id branch, which is
-- true of every role.
-- ===========================================================================

create or replace function public.can_view_report(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = rid
      and (
        r.author_id = auth.uid()
        or public.is_privileged()
        or (
          public.user_role()::text = 'coordinator'
          and r.type = 'budget'
          and r.status <> 'draft'
        )
      )
  );
$$;

grant execute on function public.can_view_report(uuid) to authenticated;

drop policy if exists "reports: select" on public.reports;
create policy "reports: select" on public.reports
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_privileged()
    or (
      public.user_role()::text = 'coordinator'
      and type = 'budget'
      and status <> 'draft'
    )
  );

-- ===========================================================================
-- Seeded from the Jan–June workbook, 2025 and 2026
--
-- Generated rather than transcribed. Months July–December are zero for both
-- years and are filled in as the year is reported; a zero month renders as an
-- empty cell, not as $0.00, so an unreported month never reads as a reported
-- nothing.
-- ===========================================================================

insert into public.project_reports (stream, period_year)
values
  ('sales', 2026), ('sales', 2025),
  ('leasing', 2026), ('leasing', 2025),
  ('property_management', 2026), ('property_management', 2025)
on conflict (stream, period_year) do nothing;

with seed (stream, period_year, name, sort_order,
           m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12,
           u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12) as (
  values
  ('sales', 2026, 'Land', 10, 5724800.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2026, 'House', 20, 0.00, 62000.00, 0.00, 0.00, 6140908.00, 718500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 1, 0, 0, 5, 2, 0, 0, 0, 0, 0, 0),
  ('sales', 2026, 'Condo', 30, 210483.00, 0.00, 1007888.00, 909816.00, 791807.00, 534065.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 2, 0, 6, 3, 6, 5, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'Land', 10, 0.00, 0.00, 5735748.00, 11090000.00, 2496000.00, 976500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'House', 20, 0.00, 0.00, 0.00, 0.00, 809771.00, 908800.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 10, 11, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'Condo', 30, 102432.00, 442207.00, 0.00, 0.00, 513868.00, 985000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1, 3, 0, 0, 4, 7, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'The Elysee', 10, 110643.01, 115598.91, 125258.05, 100409.29, 97175.93, 108803.44, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'Elite Garden', 20, 13200.00, 7350.00, 7350.00, 13350.00, 5850.00, 8850.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'Elite Cove', 30, 17450.00, 15700.00, 24150.00, 9400.00, 34150.00, 31900.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'La Seine', 40, 9800.00, 11300.00, 27200.00, 15100.00, 14230.00, 13000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'Night Market', 50, 111833.30, 112076.97, 123801.32, 112402.97, 122533.81, 123030.42, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'Commercial Lease', 60, 90099.10, 119551.64, 120580.67, 126548.64, 114335.68, 116717.44, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'Connexion Hub', 70, 57014.32, 60342.62, 62279.33, 58775.96, 217349.81, 72914.97, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'The Elysee', 10, 97231.81, 68591.73, 123435.50, 73684.56, 76524.46, 73550.46, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'Elite Garden', 20, 11250.00, 11250.00, 9350.00, 15200.00, 9350.00, 9350.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'Elite Cove', 30, 10050.00, 20850.00, 12050.00, 14250.00, 11927.42, 11250.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'La Seine', 40, 11150.00, 9650.00, 11150.00, 31150.00, 16150.00, 16150.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'Night Market', 50, 114066.12, 121310.40, 108084.28, 111967.07, 113418.72, 110267.37, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'Commercial Lease', 60, 53334.93, 22856.36, 69377.38, 58261.25, 66161.17, 60308.83, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'Connexion Hub', 70, 12151.82, 136844.14, 14255.22, 16894.05, 131412.41, 24004.03, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2026, 'The Elysée', 10, 162806.41, 190879.48, 233099.17, 155929.33, 187802.49, 183374.17, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2026, 'La Seine', 20, 17409.56, 18955.87, 39472.70, 15641.42, 18355.40, 17752.24, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2026, 'Elite Cove', 30, 30079.48, 22843.59, 35275.72, 16600.52, 9922.34, 41835.86, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2026, 'Elite Garden', 40, 34254.98, 24534.55, 32344.31, 16195.68, 41028.32, 15709.38, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2025, 'The Elysée', 10, 147291.23, 136761.04, 190950.35, 122972.94, 134421.20, 122860.78, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2025, 'La Seine', 20, 34755.00, 14750.00, 19618.30, 32553.74, 21256.09, 18917.03, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2025, 'Elite Cove', 30, 21723.86, 36805.53, 27169.91, 19576.20, 21465.30, 17316.21, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('property_management', 2025, 'Elite Garden', 40, 41963.00, 21374.52, 34835.88, 18505.99, 16559.99, 13952.23, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
)
insert into public.project_report_items (
  report_id, name, sort_order,
  m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12,
  u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12
)
select r.id, s.name, s.sort_order,
  s.m01, s.m02, s.m03, s.m04, s.m05, s.m06,
  s.m07, s.m08, s.m09, s.m10, s.m11, s.m12,
  s.u01, s.u02, s.u03, s.u04, s.u05, s.u06,
  s.u07, s.u08, s.u09, s.u10, s.u11, s.u12
from seed s
join public.project_reports r
  on r.stream = s.stream::public.project_stream
 and r.period_year = s.period_year
on conflict (report_id, name) do nothing;
