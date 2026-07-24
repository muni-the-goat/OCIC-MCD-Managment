-- Allow multiple monthly budget reports per author for the same month/year.
--
-- Migration 0009 enforced one monthly budget per author/month/year with a
-- trigger. The office has asked to lift that: a team may now file more than one
-- budget report for the same month (e.g. a separate report per purchase). We
-- drop the trigger and its function.
--
-- The reports_monthly_budget_period_lookup index from 0009 stays — it is a plain
-- lookup index, not a uniqueness guarantee, and still speeds the period queries.
--
-- Aggregation already tolerates multiples: the annual summary and the
-- department × month matrix sum every reviewed monthly budget, so two reports for
-- the same month simply add together.

drop trigger if exists reports_enforce_monthly_budget_uniqueness
  on public.reports;

drop function if exists public.enforce_monthly_budget_uniqueness();
