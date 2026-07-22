-- Three changes, in one migration because they overlap on the same policies.
--
--   A. Departments become a table, so they can be added from the app instead of
--      needing a migration every time the org chart changes.
--   B. A Manager sees only their own reports. They lose cross-office visibility
--      and, necessarily, the ability to reject — you cannot reject what you
--      cannot see.
--   C. Head of Department becomes admin-equivalent for reports and users, with
--      password reset deliberately withheld.

-- ===========================================================================
-- A. Departments as data
-- ===========================================================================

create table if not exists public.departments (
  -- The id is a stored value on every profile, so it is generated once from the
  -- label and then frozen. Renaming a department changes its label, never this.
  id text primary key
    check (id ~ '^[a-z][a-z0-9_]{1,48}$'),
  label text not null
    check (char_length(btrim(label)) between 1 and 60),
  -- For the department x month matrix, where eight full names make a table
  -- nobody can fit on a laptop.
  short text not null
    check (char_length(btrim(short)) between 1 and 24),
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists departments_label_unique
  on public.departments (lower(btrim(label)));

-- The eight that were hard-coded in src/lib/types.ts, in their display order.
-- Admin/HR keeps the last slot as the non-marketing bucket.
insert into public.departments (id, label, short, sort_order) values
  ('digital_marketing',     'Digital Marketing',     'Digital',     10),
  ('multimedia',            'Multimedia',            'Multimedia',  20),
  ('brand_marketing',       'Brand Marketing',       'Brand',       30),
  ('product_marketing',     'Product Marketing',     'Product',     40),
  ('kti_marketing',         'KTI Marketing',         'KTI',         50),
  ('partnership_marketing', 'Partnership Marketing', 'Partnership', 60),
  ('event_marketing',       'Event Marketing',       'Event',       70),
  ('admin_hr',              'Admin/HR',              'Admin/HR',    80)
on conflict (id) do nothing;

-- The check constraint required a migration per department. A foreign key does
-- the same job against a list the app can extend.
alter table public.profiles
  drop constraint if exists profiles_department_check;

alter table public.profiles
  drop constraint if exists profiles_department_fkey;

alter table public.profiles
  add constraint profiles_department_fkey
  foreign key (department) references public.departments (id)
  on update cascade
  on delete set null;

alter table public.departments enable row level security;

-- Everyone signed in reads the list; it is on every report row and in every
-- picker. Writes go through the service-role admin client behind a role guard,
-- so there is deliberately no write policy here.
drop policy if exists "departments: read all" on public.departments;
create policy "departments: read all" on public.departments
  for select to authenticated
  using (true);

-- ===========================================================================
-- B. A Manager sees only their own reports
--
-- Cross-office visibility was what made "reject" possible for a Manager. Taking
-- the first away takes the second with it, so the Manager is removed from every
-- review path below rather than left holding a power with nothing in reach.
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
        or public.user_role()::text in ('admin', 'head_of_department')
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
    or public.user_role()::text in ('admin', 'head_of_department')
    or (
      public.user_role()::text = 'coordinator'
      and type = 'budget'
      and status <> 'draft'
    )
  );

-- ===========================================================================
-- C. Head of Department becomes admin-equivalent
--
-- Everything an Admin can do to a report or an account, except reset a
-- password. That exception is enforced in the server action, not here: password
-- reset never touches these tables, it goes through the Auth Admin API.
-- ===========================================================================

drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (
    public.user_role()::text in ('admin', 'head_of_department')
    and status = 'submitted'
  )
  with check (
    reviewed_by = auth.uid()
    and status in ('reviewed', 'rejected')
    and public.user_role()::text in ('admin', 'head_of_department')
  );

-- Was "reports: admin update". Renamed because it is no longer admin-only.
drop policy if exists "reports: admin update" on public.reports;
drop policy if exists "reports: privileged update" on public.reports;
create policy "reports: privileged update" on public.reports
  for update to authenticated
  using (public.user_role()::text in ('admin', 'head_of_department'))
  with check (public.user_role()::text in ('admin', 'head_of_department'));

drop policy if exists "reports: delete" on public.reports;
create policy "reports: delete" on public.reports
  for delete to authenticated
  using (
    (author_id = auth.uid() and status = 'draft')
    or public.user_role()::text in ('admin', 'head_of_department')
  );

drop policy if exists "comments: delete own or admin" on public.report_comments;
create policy "comments: delete own or privileged" on public.report_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.user_role()::text in ('admin', 'head_of_department')
  );

-- can_edit_report() gates budget items, attachments, and the storage bucket.
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
        or public.user_role()::text in ('admin', 'head_of_department')
      )
  );
$$;

grant execute on function public.can_edit_report(uuid) to authenticated;

-- Review authority: mark reviewed and reject both narrow to Admin and Head of
-- Department, and both may now review a report they authored. Self-review is
-- part of "everything an Admin can do"; if that turns out to be too much, this
-- function and the trigger below are the two places to put the Manager-style
-- restriction back.
create or replace function public.review_report(
  p_report_id uuid,
  p_decision public.report_status,
  p_comment text default ''
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_report_id uuid;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_role text := public.user_role()::text;
begin
  if p_decision is null or p_decision not in ('reviewed', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  if coalesce(v_role, '') not in ('admin', 'head_of_department') then
    raise exception 'Only an Admin or the Head of Department can decide on reports';
  end if;

  if p_decision = 'rejected' and v_comment = '' then
    raise exception 'A comment explaining the rejection is required';
  end if;

  if char_length(v_comment) > 4000 then
    raise exception 'Comment is too long';
  end if;

  update public.reports
  set
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_report_id
    and status = 'submitted'
  returning id into v_report_id;

  if v_report_id is null then
    return false;
  end if;

  if v_comment <> '' then
    insert into public.report_comments (report_id, author_id, body)
    values (p_report_id, auth.uid(), v_comment);
  end if;

  return true;
end;
$$;

revoke all on function public.review_report(uuid, public.report_status, text)
  from public;
grant execute on function public.review_report(uuid, public.report_status, text)
  to authenticated;

create or replace function public.enforce_report_review_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := public.user_role()::text;
begin
  if new.status in ('reviewed', 'rejected')
    and new.status is distinct from old.status then
    if old.status <> 'submitted' then
      raise exception 'Only submitted reports can be reviewed or rejected';
    end if;

    if coalesce(v_role, '') not in ('admin', 'head_of_department') then
      raise exception 'Only an Admin or the Head of Department can decide on reports';
    end if;
  end if;

  return new;
end;
$$;

-- Note on what is deliberately NOT widened: "profiles: admin all" stays
-- admin-only. A Head of Department manages accounts through the server actions,
-- which use the service-role client and carry their own guards — including the
-- two that keep "no password reset" from being decorative: a Head of Department
-- cannot grant the admin role, and cannot modify or delete an admin account.
-- Widening this policy would hand them a direct API route around both.
