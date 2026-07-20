-- Add the Head of Department role and reserve positive review approval for it.
-- Managers and admins retain visibility of submitted reports and may reject
-- them with feedback, but cannot mark them as reviewed.

alter type public.app_role
  add value if not exists 'head_of_department';

-- HoDs need the same cross-office report visibility as managers/admins.
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
        or public.user_role()::text = 'admin'
        or (
          public.user_role()::text in ('manager', 'head_of_department')
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
    or public.user_role()::text = 'admin'
    or (
      public.user_role()::text in ('manager', 'head_of_department')
      and status <> 'draft'
    )
  );

-- RLS permits submitted-report decisions according to the requested split:
-- only HoD can review; manager/admin/HoD can reject.
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
        and public.user_role()::text = 'head_of_department'
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
    and coalesce(v_role, '') <> 'head_of_department' then
    raise exception 'Only the Head of Department can mark reports as reviewed';
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

-- The trigger prevents privileged update policies (including the admin policy)
-- from bypassing the HoD-only approval rule.
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
      and coalesce(v_role, '') <> 'head_of_department' then
      raise exception 'Only the Head of Department can mark reports as reviewed';
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
