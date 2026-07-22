-- Run after 0013.
--
-- A Coordinator may now approve a report, including one they authored, but may
-- never reject. Approving and rejecting stop being one permission:
--
--   Mark reviewed  Admin, Head of Department, Coordinator
--   Reject         Admin, Head of Department
--
-- Rejection sends a report back with required feedback — it is the one decision
-- that creates work for someone else, so it stays with the Head of Department
-- and the Admin above them.
--
-- A Coordinator only ever sees budget reports plus their own (migration 0012),
-- and the update policy below is scoped to match. Without that scoping the
-- policy would let them approve a monthly activity report they cannot read,
-- because an UPDATE policy's USING clause is evaluated on its own and does not
-- inherit the SELECT policy's narrower reach.

drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (
    status = 'submitted'
    and (
      public.user_role()::text in ('admin', 'head_of_department')
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
        and public.user_role()::text in ('admin', 'head_of_department')
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
  v_role text := public.user_role()::text;
begin
  if p_decision is null or p_decision not in ('reviewed', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  if p_decision = 'reviewed'
    and coalesce(v_role, '') not in (
      'admin',
      'head_of_department',
      'coordinator'
    ) then
    raise exception 'You do not have permission to mark reports as reviewed';
  end if;

  if p_decision = 'rejected'
    and coalesce(v_role, '') not in ('admin', 'head_of_department') then
    raise exception 'Only an Admin or the Head of Department can reject a report';
  end if;

  if p_decision = 'rejected' and v_comment = '' then
    raise exception 'A comment explaining the rejection is required';
  end if;

  if char_length(v_comment) > 4000 then
    raise exception 'Comment is too long';
  end if;

  -- Self-review is allowed for all three roles. The update runs under the
  -- caller's RLS, so the policy above is what keeps a Coordinator away from
  -- someone else's activity report.
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
  v_role text := public.user_role()::text;
begin
  if new.status in ('reviewed', 'rejected')
    and new.status is distinct from old.status then
    if old.status <> 'submitted' then
      raise exception 'Only submitted reports can be reviewed or rejected';
    end if;

    if new.status = 'reviewed'
      and coalesce(v_role, '') not in (
        'admin',
        'head_of_department',
        'coordinator'
      ) then
      raise exception 'You do not have permission to mark reports as reviewed';
    end if;

    if new.status = 'rejected'
      and coalesce(v_role, '') not in ('admin', 'head_of_department') then
      raise exception 'Only an Admin or the Head of Department can reject a report';
    end if;

    if new.status = 'reviewed'
      and coalesce(v_role, '') = 'coordinator'
      and new.type <> 'budget'
      and new.author_id <> auth.uid() then
      raise exception 'A Coordinator can only review budget reports';
    end if;
  end if;

  return new;
end;
$$;
