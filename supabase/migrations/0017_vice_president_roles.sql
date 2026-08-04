-- Two new roles above the department line.
--
--   Vice President  Identical to Head of Department everywhere. Approves,
--                   rejects, edits and deletes any report, manages accounts and
--                   departments, and sets the approved annual budget. Like a
--                   Head of Department they cannot reset a password.
--
--   VP Assistant    Reads the whole office and decides nothing. Every submitted
--                   report of either type, its line items, comments and
--                   attachments — and no approve, no reject, no edit, no delete,
--                   no account management, no password reset. This is a wider
--                   read than a Coordinator (who stops at budget reports) with
--                   strictly less authority (a Coordinator can approve).
--
-- Every check below compares public.user_role()::text against string literals
-- rather than enum literals. That is what lets the two ADD VALUE statements and
-- the policies that name them live in one migration: Postgres refuses to use a
-- newly added enum value in the transaction that added it, but casting to text
-- sidesteps the restriction entirely. Migration 0006 set the same precedent.

alter type public.app_role
  add value if not exists 'vice_president';

alter type public.app_role
  add value if not exists 'vp_assistant';

-- ===========================================================================
-- The privileged set becomes a function
--
-- ('admin', 'head_of_department') was written out in fifteen places across
-- migrations 0006–0015, so adding a third member meant touching all fifteen and
-- hoping none were missed. One function instead — the next role that joins this
-- tier is a one-line change here, and every policy picks it up.
-- ===========================================================================

create or replace function public.is_privileged()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.user_role()::text, '') in (
    'admin',
    'head_of_department',
    'vice_president'
  );
$$;

grant execute on function public.is_privileged() to authenticated;

-- ===========================================================================
-- Reading
--
-- can_view_report() gates budget_items, report_comments, report_attachments and
-- the storage bucket, so widening it here is what actually lets a VP Assistant
-- read the numbers and open the files.
--
-- Drafts stay private for a VP Assistant, exactly as they do for a Coordinator.
-- A draft is a working copy, not a submission, and a read-only observer has no
-- business in one.
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
          public.user_role()::text = 'vp_assistant'
          and r.status <> 'draft'
        )
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
      public.user_role()::text = 'vp_assistant'
      and status <> 'draft'
    )
    or (
      public.user_role()::text = 'coordinator'
      and type = 'budget'
      and status <> 'draft'
    )
  );

-- ===========================================================================
-- Writing
--
-- A VP Assistant appears in none of what follows. Read-only means the update,
-- delete and review paths do not know the role exists.
-- ===========================================================================

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
        or public.is_privileged()
      )
  );
$$;

grant execute on function public.can_edit_report(uuid) to authenticated;

drop policy if exists "reports: privileged update" on public.reports;
create policy "reports: privileged update" on public.reports
  for update to authenticated
  using (public.is_privileged())
  with check (public.is_privileged());

drop policy if exists "reports: delete" on public.reports;
create policy "reports: delete" on public.reports
  for delete to authenticated
  using (
    (author_id = auth.uid() and status = 'draft')
    or public.is_privileged()
  );

drop policy if exists "comments: delete own or privileged" on public.report_comments;
create policy "comments: delete own or privileged" on public.report_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_privileged()
  );

-- ===========================================================================
-- Deciding
--
-- Unchanged in shape from 0014, with the privileged list swapped for the
-- function:
--
--   Mark reviewed  Admin, Head of Department, Vice President, Coordinator
--   Reject         Admin, Head of Department, Vice President
-- ===========================================================================

drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (
    status = 'submitted'
    and (
      public.is_privileged()
      or (
        public.user_role()::text = 'coordinator'
        and (type = 'budget' or author_id = auth.uid())
      )
    )
  )
  with check (
    reviewed_by = auth.uid()
    and (
      (
        status in ('reviewed', 'rejected')
        and public.is_privileged()
      )
      or (
        status = 'reviewed'
        and public.user_role()::text = 'coordinator'
      )
    )
  );

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
  v_role text := coalesce(public.user_role()::text, '');
begin
  if p_decision is null or p_decision not in ('reviewed', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  if p_decision = 'reviewed'
    and not public.is_privileged()
    and v_role <> 'coordinator' then
    raise exception 'You do not have permission to mark reports as reviewed';
  end if;

  if p_decision = 'rejected' and not public.is_privileged() then
    raise exception 'You do not have permission to reject a report';
  end if;

  if p_decision = 'rejected' and v_comment = '' then
    raise exception 'A comment explaining the rejection is required';
  end if;

  if char_length(v_comment) > 4000 then
    raise exception 'Comment is too long';
  end if;

  -- Self-review is allowed for every role that can decide at all. The update
  -- runs under the caller's RLS, so the policy above is what keeps a
  -- Coordinator away from someone else's activity report.
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

-- Protects direct status updates as well as calls through review_report().
create or replace function public.enforce_report_review_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := coalesce(public.user_role()::text, '');
begin
  if new.status in ('reviewed', 'rejected')
    and new.status is distinct from old.status then
    if old.status <> 'submitted' then
      raise exception 'Only submitted reports can be reviewed or rejected';
    end if;

    if new.status = 'reviewed'
      and not public.is_privileged()
      and v_role <> 'coordinator' then
      raise exception 'You do not have permission to mark reports as reviewed';
    end if;

    if new.status = 'rejected' and not public.is_privileged() then
      raise exception 'You do not have permission to reject a report';
    end if;

    if new.status = 'reviewed'
      and v_role = 'coordinator'
      and new.type <> 'budget'
      and new.author_id <> auth.uid() then
      raise exception 'A Coordinator can only review budget reports';
    end if;
  end if;

  return new;
end;
$$;

-- Note on what is deliberately NOT widened, carried forward from 0013:
-- "profiles: admin all" stays admin-only. A Vice President manages accounts
-- through the server actions, which use the service-role client and carry their
-- own guards — including the two that keep "no password reset" from being
-- decorative: they cannot grant the admin role, and cannot modify or delete an
-- admin account. Widening that policy would hand them a route around both.
