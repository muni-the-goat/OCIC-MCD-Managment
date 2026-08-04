-- Chroy Changvar Bay, 2025 and 2026 to date.
--
-- From "CCV Bay Sale Performance Report" and "CCV Leasing Jan-May Report".
-- Generated from the source figures rather than transcribed, for the reason
-- 0018 gave: the workbooks already contain one arithmetic error and two
-- hundred hand-copied numbers would add more. Every row, column and comparison
-- in the CCV sheets was reconciled before this was written and all of them
-- agree — including both stated percentages, 130% on units and 66.79% on value.
--
-- Two things worth recording about how this project differs from Koh Pich, both
-- of which the schema already allowed for and neither of which needed a change:
--
--   1. It sells a fourth thing. Koh Pich reports Land, House and Condo; Chroy
--      Changvar Bay adds Commercial Building. Item rows are held per report
--      rather than in a shared list, so the two projects simply carry different
--      rows. This is the case 0018's comment about Connexion Hub anticipated.
--
--   2. It has no property management report. Nothing is inserted for that
--      stream, and the dashboard renders only the streams a project actually
--      has — an absent report is not the same as an empty one, and a card
--      reading "nothing recorded" would describe a report that does not exist
--      rather than one nobody has filled in.
--
-- Its leasing is reported as a single "External" line rather than per property,
-- which is how the CCV sheet is drawn. Nothing here requires the two projects to
-- report the same way.
--
-- One cosmetic note on the source, recorded because it will be noticed by
-- somebody comparing this to the PDF: the 2025 May row's Total cell prints as
-- "$ 56,8124.00", a misplaced comma for $568,124.00. Every total that depends
-- on it is correct, so the figure below is the intended one.

insert into public.project_reports (project_id, stream, period_year)
values
  ('chroy_changvar_bay', 'sales', 2026),
  ('chroy_changvar_bay', 'sales', 2025),
  ('chroy_changvar_bay', 'leasing', 2026),
  ('chroy_changvar_bay', 'leasing', 2025)
on conflict (project_id, stream, period_year) do nothing;

with seed (stream, period_year, name, sort_order,
           m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12,
           u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12) as (
  values
  ('sales', 2026, 'Commercial Building', 10, 0.00, 0.00, 0.00, 1582891.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2026, 'House', 20, 2185083.00, 777124.00, 1672205.00, 809368.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4, 3, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2026, 'Land', 30, 0.00, 93571.00, 95887.00, 217537.00, 441529.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 1, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2026, 'Condo', 40, 0.00, 0.00, 0.00, 0.00, 67586.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'Commercial Building', 10, 810566.00, 1583470.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'House', 20, 207109.00, 0.00, 354049.00, 0.00, 568124.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'Land', 30, 1108800.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('sales', 2025, 'Condo', 40, 0.00, 43784.00, 0.00, 86352.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2026, 'External', 10, 248881.45, 319342.88, 269530.59, 253782.97, 272987.79, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  ('leasing', 2025, 'External', 10, 257729.46, 327921.98, 266228.53, 261142.74, 261236.22, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

)
insert into public.project_report_items (
  report_id, name, sort_order,
  m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12,
  u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12
)
select r.id, s.name, s.sort_order,
  s.m01, s.m02, s.m03, s.m04, s.m05, s.m06,
  s.m07, s.m08, s.m09, s.m10, s.m11, s.m12,
  s.u01, s.u02, s.u03, s.u04, s.u05, s.u06,
  s.u07, s.u08, s.u09, s.u10, s.u11, s.u12
from seed s
join public.project_reports r
  on r.project_id = 'chroy_changvar_bay'
 and r.stream = s.stream::public.project_stream
 and r.period_year = s.period_year
on conflict (report_id, name) do nothing;
