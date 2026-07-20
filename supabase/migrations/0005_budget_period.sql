-- Allow budget reports to represent either a whole fiscal year or one month.
-- Existing budget reports remain annual through the default value.

alter table public.reports
  add column budget_period text not null default 'annual'
  check (budget_period in ('annual', 'monthly'));

comment on column public.reports.budget_period is
  'Budget reporting period: annual Jan-Dec grid or a separate monthly report.';
