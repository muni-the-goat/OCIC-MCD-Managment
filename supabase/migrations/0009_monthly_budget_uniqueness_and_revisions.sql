-- Enforce one monthly budget report per author/month/year going forward and
-- allow authors to revise submitted or reviewed reports. Existing duplicate
-- periods are preserved so this migration never deletes production data.

drop policy if exists "reports: author update" on public.reports;
create policy "reports: author update" on public.reports
  for update to authenticated
  using (
    author_id = auth.uid()
    and status in ('draft', 'submitted', 'reviewed', 'rejected')
  )
  with check (
    author_id = auth.uid()
    and status in ('draft', 'submitted')
  );

create index if not exists reports_monthly_budget_period_lookup
  on public.reports (author_id, period_year, period_month)
  where type = 'budget' and budget_period = 'monthly';

create or replace function public.enforce_monthly_budget_uniqueness()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period_changed boolean := false;
begin
  if new.type <> 'budget' or new.budget_period <> 'monthly' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_period_changed := true;
  else
    v_period_changed :=
      new.author_id is distinct from old.author_id
      or new.type is distinct from old.type
      or new.budget_period is distinct from old.budget_period
      or new.period_year is distinct from old.period_year
      or new.period_month is distinct from old.period_month;
  end if;

  -- Unchanged legacy duplicates remain editable. New reports and moves to a
  -- different period are rejected when that author/period already exists.
  if v_period_changed then
    -- Serialize attempts for the same author/month so concurrent submissions
    -- cannot both pass the existence check.
    perform pg_advisory_xact_lock(
      hashtextextended(
        new.author_id::text || ':' || new.period_year::text || ':' || new.period_month::text,
        0
      )
    );

    if exists (
      select 1
      from public.reports r
      where r.author_id = new.author_id
        and r.type = 'budget'
        and r.budget_period = 'monthly'
        and r.period_year = new.period_year
        and r.period_month = new.period_month
        and r.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'A monthly budget report already exists for this author and period';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_enforce_monthly_budget_uniqueness
  on public.reports;
create trigger reports_enforce_monthly_budget_uniqueness
  before insert or update of
    author_id,
    type,
    budget_period,
    period_year,
    period_month
  on public.reports
  for each row execute function public.enforce_monthly_budget_uniqueness();
