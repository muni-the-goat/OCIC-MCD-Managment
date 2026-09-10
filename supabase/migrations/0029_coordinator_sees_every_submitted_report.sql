-- A Coordinator reads every submitted report, and may approve either kind.
--
-- Migration 0012 gave the Coordinator the office's budget reports and stopped
-- there, on the reading that their oversight was spend: "Monthly activity
-- reports stay private to their author and the review chain — a Coordinator
-- sees only their own." That is not the job. The Coordinator oversees what the
-- office files, and ten submitted activity reports were invisible to the person
-- expected to keep track of them.
--
-- What changes:
--
--   Reading    every non-draft report, of either type, plus their own drafts.
--              Was: every non-draft *budget* report, plus their own.
--
--   Approving  either type. Was: budget only, or one they authored themselves.
--
-- What deliberately does not change:
--
--   Rejecting  still Admin and Head of Department. Rejection sends a report
--              back with required feedback — it is the one decision that
--              creates work for someone else, and 0014 put it here on purpose.
--
--   Drafts     still private to their author, for every role but Admin and
--              Head of Department. A draft is a working copy, not a submission,
--              and that rule is older than this one.
--
--   Editing    can_edit_report() is untouched. A Coordinator can open anyone's
--              report, its line items, its comments and its attachments, and
--              change none of them.
--
-- Four places scoped the Coordinator to budget and all four have to move
-- together. Leaving any one behind is not a smaller change, it is an
-- inconsistent one: the select policy alone would show reports the review
-- policy still refuses to act on, and the trigger alone would refuse writes the
-- policy has already allowed.
--
--   1. the reports SELECT policy          (last set in 0018)
--   2. can_view_report()                  (last set in 0018) — this is the one
--      that gates budget_items, report_comments, report_attachments and the
--      storage bucket, so without it a report would open with nothing in it
--   3. the reports review UPDATE policy   (last set in 0017)
--   4. enforce_report_review_transition() (last set in 0017) — the backstop for
--      a direct database update that goes around the application
--
-- review_report() itself needs no change: it never tested the report's type,
-- leaving that to the policy and the trigger below.

-- ===========================================================================
-- 1. Reading the report
-- ===========================================================================

drop policy if exists "reports: select" on public.reports;
create policy "reports: select" on public.reports
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_privileged()
    or (
      public.user_role()::text = 'coordinator'
      and status <> 'draft'
    )
  );

-- ===========================================================================
-- 2. Reading what is attached to it
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
          and r.status <> 'draft'
        )
      )
  );
$$;

grant execute on function public.can_view_report(uuid) to authenticated;

-- ===========================================================================
-- 3. Deciding on it
--
-- The WITH CHECK is unchanged and is what still keeps rejection away from a
-- Coordinator: they may only land a row on 'reviewed'.
-- ===========================================================================

drop policy if exists "reports: review submitted" on public.reports;
create policy "reports: review submitted" on public.reports
  for update to authenticated
  using (
    status = 'submitted'
    and (
      public.is_privileged()
      or public.user_role()::text = 'coordinator'
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

-- ===========================================================================
-- 4. The backstop
--
-- Protects direct status updates as well as calls through review_report().
-- The clause that raised 'A Coordinator can only review budget reports' is
-- gone; everything else in this function is exactly as 0017 left it.
-- ===========================================================================

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
  end if;

  return new;
end;
$$;

-- The trigger is recreated rather than assumed, so this file stands on its own
-- if it is ever run against a database where 0004 was applied by hand.
drop trigger if exists reports_enforce_review_transition on public.reports;
create trigger reports_enforce_review_transition
  before update of status on public.reports
  for each row execute function public.enforce_report_review_transition();
