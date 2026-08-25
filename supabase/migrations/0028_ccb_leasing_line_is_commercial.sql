-- Chroy Changvar Bay's leasing line is named Commercial, not External.
--
-- Renamed at the Vice President's request. One line, in both years.
--
-- Both years, and that is the whole point of doing them together: a unit's name
-- is its identity here, and propertyComparison() matches this year against last
-- on that name. Renaming 2026 alone would not rename a property, it would
-- invent a second one — the by-property chart would grow a bar for 'Commercial'
-- with no last year beside it and a bar for 'External' with no this year, and
-- the report would look like a building had been replaced rather than relabelled.
-- Migration 0025 settled a spelling for the same reason.
--
-- The category is deliberately left as Unassigned. Filing it under Commercial
-- was offered and declined; the line keeps its band, and the table still groups
-- it under Unassigned.
--
-- Idempotent: once renamed, the predicate matches nothing.

update public.project_report_items as i
set name = 'Commercial'
from public.project_reports as r
where i.report_id = r.id
  and r.project_id = 'chroy_changvar_bay'
  and r.stream = 'leasing'
  and i.name = 'External';
