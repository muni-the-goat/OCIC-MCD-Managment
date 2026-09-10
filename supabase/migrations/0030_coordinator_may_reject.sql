-- A Coordinator may reject a report as well as approve it.
--
-- 0014 split approving from rejecting and kept rejection back:
--
--   "Rejection sends a report back with required feedback — it is the one
--    decision that creates work for someone else, so it stays with the Head of
--    Department and the Admin above them."
--
-- The office has asked for it, so the split closes. A Coordinator now holds
-- both decisions on both kinds of report, which is the whole of the review
-- authority an Admin and a Head of Department hold.
--
-- What still does not change:
--
--   The comment  a rejection without one is still refused. That rule is not
--                about who is deciding, it is about the author being told why,
--                and it is the only thing that makes a rejection actionable.
--
--   Submitted    only a submitted report can be decided on, so a decision
--                cannot be revisited by deciding again.
--
--   Editing      can_edit_report() is untouched.
--
-- Three places carried the restriction. Rather than change the same clause in
-- three shapes for the fourth time, the question moves into a function and the
-- three places ask it. 0029 had to move four scattered clauses in step; this is
-- what stops the next change being that.

-- ===========================================================================
-- Who decides on a submitted report
-- ===========================================================================

create or replace function public.reviews_reports()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_privileged()
      or coalesce(public.user_role()::text, '') = 'coordinator';
$$;

grant execute on function public.reviews_reports() to authenticated;

-- ===========================================================================
-- The policy
--
-- Approving and rejecting were two arms of the WITH CHECK because two different
-- sets of roles could reach them. One set now reaches both.
-- ===========================================================================

drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (status = 'submitted' and public.reviews_reports())
  with check (
    reviewed_by = auth.uid()
    and status in ('reviewed', 'rejected')
    and public.reviews_reports()
  );

-- ===========================================================================
-- The RPC
--
-- Unchanged apart from the two permission checks, which become one. The comment
-- requirement, the length cap, the submitted-only update and the self-review
-- note are exactly as 0017 left them.
-- ===========================================================================

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
begin
  if p_decision is null or p_decision not in ('reviewed', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  if not public.reviews_reports() then
    raise exception 'You do not have permission to decide on reports';
  end if;

  -- Not a permission check. An author sent back without a reason has been told
  -- to do something again without being told what.
  if p_decision = 'rejected' and v_comment = '' then
    raise exception 'A comment explaining the rejection is required';
  end if;

  if char_length(v_comment) > 4000 then
    raise exception 'Comment is too long';
  end if;

  -- Self-review is allowed for every role that can decide at all. The update
  -- runs under the caller's RLS, so the policy above is what decides reach.
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

-- ===========================================================================
-- The backstop
--
-- Protects direct status updates as well as calls through review_report().
-- ===========================================================================

create or replace function public.enforce_report_review_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('reviewed', 'rejected')
    and new.status is distinct from old.status then
    if old.status <> 'submitted' then
      raise exception 'Only submitted reports can be reviewed or rejected';
    end if;

    if not public.reviews_reports() then
      raise exception 'You do not have permission to decide on reports';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_enforce_review_transition on public.reports;
create trigger reports_enforce_review_transition
  before update of status on public.reports
  for each row execute function public.enforce_report_review_transition();
