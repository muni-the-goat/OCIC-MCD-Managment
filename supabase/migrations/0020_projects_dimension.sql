-- Projects become a dimension.
--
-- 0018 modelled one report per stream per year, on the reading that the
-- workbook was Koh Pich and Koh Pich was the whole of it. It is not: the same
-- three reports exist for Chroy Changvar Bay, and will exist for whatever OCIC
-- breaks ground on next. A report is therefore one project's stream for one
-- year, and the uniqueness constraint moves with it.
--
-- A table rather than an enum or a check constraint, for exactly the reason
-- migration 0013 gave when departments stopped being hard-coded: a fixed list
-- means a migration every time the org changes, and a foreign key does the same
-- job against a list the application can extend. The id is frozen at creation
-- and stored on every report; renaming a project changes its label only.

create table if not exists public.projects (
  id text primary key
    check (id ~ '^[a-z][a-z0-9_]{1,48}$'),
  label text not null
    check (char_length(btrim(label)) between 1 and 60),
  -- For the print document's header, where "Chroy Changvar Bay" is longer than
  -- the space a letterhead line wants to give it.
  short text not null
    check (char_length(btrim(short)) between 1 and 24),
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists projects_label_unique
  on public.projects (lower(btrim(label)));

insert into public.projects (id, label, short, sort_order) values
  ('koh_pich',           'Koh Pich',           'Koh Pich', 10),
  ('chroy_changvar_bay', 'Chroy Changvar Bay', 'CCB',      20)
on conflict (id) do nothing;

alter table public.projects enable row level security;

-- Everyone signed in reads the list; it is in the filter, the form and the
-- print header. Writes would go through the service-role client behind a role
-- guard, exactly as departments do, so there is deliberately no write policy.
drop policy if exists "projects: read all" on public.projects;
create policy "projects: read all" on public.projects
  for select to authenticated
  using (true);

-- ===========================================================================
-- Every existing report is Koh Pich
--
-- The seeded 2025 and 2026 figures came from the Koh Pich workbook — "KP Sale
-- Performance", "KOH PICH LEASING REPORT" — so backfilling them to that project
-- is reading the source rather than guessing. The column is added nullable,
-- filled, then made NOT NULL, which is the only order that works on a table
-- with rows already in it.
-- ===========================================================================

alter table public.project_reports
  add column if not exists project_id text;

update public.project_reports
set project_id = 'koh_pich'
where project_id is null;

alter table public.project_reports
  alter column project_id set not null;

alter table public.project_reports
  drop constraint if exists project_reports_project_fkey;

alter table public.project_reports
  add constraint project_reports_project_fkey
  foreign key (project_id) references public.projects (id)
  on update cascade;

-- The 0018 constraint said one report per stream per year across the whole
-- company, which would now collide the moment Chroy Changvar Bay filed its
-- first leasing month. Dropped by the name Postgres generated for it, confirmed
-- against a scratch database rather than assumed.
alter table public.project_reports
  drop constraint if exists project_reports_stream_period_year_key;

alter table public.project_reports
  drop constraint if exists project_reports_project_stream_year_key;

alter table public.project_reports
  add constraint project_reports_project_stream_year_key
  unique (project_id, stream, period_year);

drop index if exists project_reports_stream_year_idx;

create index if not exists project_reports_lookup_idx
  on public.project_reports (project_id, stream, period_year desc);
