-- Add the Coordinator role and allow Admins to approve submitted reports.
-- Coordinators can access the application's Users page and reset eligible
-- passwords through its server action, but receive no database-wide admin
-- privileges and cannot delete accounts.

alter type public.app_role
  add value if not exists 'coordinator';

-- Managers and reviewers may reject. Positive approval is reserved for an
-- Admin or the Head of Department.
drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (
    public.user_role()::text in (
      'manager',
      'admin',
      'head_of_department'
    )
    and status = 'submitted'
  )
  with check (
    reviewed_by = auth.uid()
    and (
      (
        status = 'reviewed'
        and public.user_role()::text in (
          'admin',
          'head_of_department'
        )
      )
      or (
        status = 'rejected'
        and public.user_role()::text in (
          'manager',
          'admin',
          'head_of_department'
        )
      )
    )
  );

-- Keep the RPC authoritative even if a caller bypasses the application UI.
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

  if p_decision = 'reviewed'
    and coalesce(v_role, '') not in ('admin', 'head_of_department') then
    raise exception 'Only an Admin or the Head of Department can mark reports as reviewed';
  end if;

  if p_decision = 'rejected'
    and coalesce(v_role, '') not in (
      'manager',
      'admin',
      'head_of_department'
    ) then
    raise exception 'You do not have permission to reject reports';
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
    and author_id <> auth.uid()
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

-- The trigger also protects against an Admin update policy bypassing the RPC.
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

    if old.author_id = auth.uid() then
      raise exception 'Authors cannot review their own reports';
    end if;

    if new.status = 'reviewed'
      and coalesce(v_role, '') not in ('admin', 'head_of_department') then
      raise exception 'Only an Admin or the Head of Department can mark reports as reviewed';
    end if;

    if new.status = 'rejected'
      and coalesce(v_role, '') not in (
        'manager',
        'admin',
        'head_of_department'
      ) then
      raise exception 'You do not have permission to reject reports';
    end if;
  end if;

  return new;
end;
$$;
