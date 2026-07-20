-- Security and workflow hardening.
-- Run after 0003. This migration is safe for projects that already ran the
-- earlier migrations and is also included in the fresh-setup sequence.

-- Never trust raw_user_meta_data for authorization: users can supply and edit
-- that object through Supabase Auth. Elevated roles are assigned separately by
-- the application's service-role admin action.
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

-- Apply the review decision and its optional feedback in one transaction. A
-- rejected report can never be committed without its required explanation.
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

-- Enforce the review transition even if a caller bypasses the application and
-- sends a direct database update. Reviewers cannot review their own reports.
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

    if old.author_id = auth.uid() then
      raise exception 'Authors cannot review their own reports';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_enforce_review_transition on public.reports;
create trigger reports_enforce_review_transition
  before update of status on public.reports
  for each row execute function public.enforce_report_review_transition();
