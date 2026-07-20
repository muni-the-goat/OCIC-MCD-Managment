-- MCD Management — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- After creating your first user (via the dashboard or the app's login page will
-- not work until one exists), bootstrap the first admin — see the snippet at the
-- bottom of this file.

-- ============================================================================
-- Enums
-- ============================================================================

create type public.app_role as enum ('admin', 'manager', 'staff');
create type public.report_type as enum ('budget', 'monthly');
create type public.report_status as enum ('draft', 'submitted', 'approved', 'rejected');

-- ============================================================================
-- Tables
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  type public.report_type not null,
  title text not null check (char_length(title) between 1 and 200),
  period_month int not null check (period_month between 1 and 12),
  period_year int not null check (period_year between 2000 and 2100),
  status public.report_status not null default 'draft',
  -- Monthly-report sections: { summary, accomplishments, challenges, next_month_plan }
  content jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  category text not null default '',
  description text not null default '',
  amount numeric(14, 2) not null default 0,
  sort_order int not null default 0
);

create table public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index reports_author_idx on public.reports (author_id);
create index reports_status_idx on public.reports (status);
create index reports_period_idx on public.reports (period_year, period_month);
create index budget_items_report_idx on public.budget_items (report_id);
create index report_comments_report_idx on public.report_comments (report_id);
create index report_attachments_report_idx on public.report_attachments (report_id);

-- ============================================================================
-- Helper functions (security definer so they bypass RLS and avoid recursion)
-- NOTE: named user_role(), not current_role — current_role is a reserved word.
-- ============================================================================

create or replace function public.user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

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
        or public.user_role() = 'admin'
        or (public.user_role() = 'manager' and r.status <> 'draft')
      )
  );
$$;

create or replace function public.can_edit_report(rid uuid)
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
        (r.author_id = auth.uid() and r.status in ('draft', 'rejected'))
        or public.user_role() = 'admin'
      )
  );
$$;

grant execute on function public.user_role() to authenticated;
grant execute on function public.can_view_report(uuid) to authenticated;
grant execute on function public.can_edit_report(uuid) to authenticated;

-- ============================================================================
-- Profile auto-creation on signup + updated_at maintenance
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'staff'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.budget_items enable row level security;
alter table public.report_comments enable row level security;
alter table public.report_attachments enable row level security;

-- profiles ------------------------------------------------------------------
-- Everyone signed in can read profiles (needed to show author/reviewer names).
create policy "profiles: read all" on public.profiles
  for select to authenticated
  using (true);

-- Users may update their own profile but NOT their own role (role in the new
-- row must equal their current role, read via security definer).
create policy "profiles: update own (no role change)" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.user_role());

-- Admins manage everything, including role changes.
create policy "profiles: admin all" on public.profiles
  for all to authenticated
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- reports -------------------------------------------------------------------
create policy "reports: select" on public.reports
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.user_role() = 'admin'
    or (public.user_role() = 'manager' and status <> 'draft')
  );

create policy "reports: insert own" on public.reports
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status in ('draft', 'submitted')
  );

-- Authors may edit while draft/rejected; the row they save must stay theirs
-- and end up draft or submitted (resubmission sets submitted).
create policy "reports: author update" on public.reports
  for update to authenticated
  using (author_id = auth.uid() and status in ('draft', 'rejected'))
  with check (author_id = auth.uid() and status in ('draft', 'submitted'));

-- Managers/admins decide on submitted reports.
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (public.user_role() in ('manager', 'admin') and status = 'submitted')
  with check (
    public.user_role() in ('manager', 'admin')
    and status in ('approved', 'rejected')
    and reviewed_by = auth.uid()
  );

create policy "reports: admin update" on public.reports
  for update to authenticated
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

create policy "reports: delete" on public.reports
  for delete to authenticated
  using (
    (author_id = auth.uid() and status = 'draft')
    or public.user_role() = 'admin'
  );

-- budget_items --------------------------------------------------------------
create policy "budget_items: select" on public.budget_items
  for select to authenticated
  using (public.can_view_report(report_id));

create policy "budget_items: insert" on public.budget_items
  for insert to authenticated
  with check (public.can_edit_report(report_id));

create policy "budget_items: update" on public.budget_items
  for update to authenticated
  using (public.can_edit_report(report_id))
  with check (public.can_edit_report(report_id));

create policy "budget_items: delete" on public.budget_items
  for delete to authenticated
  using (public.can_edit_report(report_id));

-- report_comments -----------------------------------------------------------
create policy "comments: select" on public.report_comments
  for select to authenticated
  using (public.can_view_report(report_id));

create policy "comments: insert" on public.report_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_report(report_id));

create policy "comments: delete own or admin" on public.report_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.user_role() = 'admin');

-- report_attachments --------------------------------------------------------
create policy "attachments: select" on public.report_attachments
  for select to authenticated
  using (public.can_view_report(report_id));

create policy "attachments: insert" on public.report_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_edit_report(report_id));

create policy "attachments: delete" on public.report_attachments
  for delete to authenticated
  using (public.can_edit_report(report_id));

-- ============================================================================
-- Storage: private bucket for attachments
-- Path convention: <report_id>/<uuid>-<filename>
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments bucket: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_view_report(((storage.foldername(name))[1])::uuid)
  );

create policy "attachments bucket: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_edit_report(((storage.foldername(name))[1])::uuid)
  );

create policy "attachments bucket: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_edit_report(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- Bootstrap the first admin
-- ============================================================================
-- 1. Create your own user first: Supabase Dashboard → Authentication → Users →
--    "Add user" (email + password, check "Auto Confirm User").
-- 2. Then promote it:
--
--    update public.profiles set role = 'admin'
--    where email = 'you@example.com';
--
-- After that, invite everyone else from the app's /admin/users page.
