-- A row's identity is its name, not its name plus its category.
--
-- 0022 keyed project_report_items on (report_id, category, name), reasoning
-- that a "Phase 1" under Land and a "Phase 1" under Condo are different things.
-- True in the abstract, and wrong here, because it makes a category a part of
-- what a row *is* rather than something a row *has*. Two consequences, both of
-- which showed up the first time somebody used the form:
--
--   1. Changing a row's category did not move it. The upsert matched on the
--      category too, found no row, and inserted a second one — leaving the
--      original in place. That is where the Koh Pich sales report's phantom
--      "Unassigned / Commercial" came from while "Commercial / Commercial" was
--      still sitting beside it.
--
--   2. It made the obvious fix dangerous. Deleting rows the form did not post
--      would, on a category change, delete the row holding eleven months of
--      figures and leave the freshly-inserted empty one in its place.
--
-- With the name alone as the key, changing a category is an update of the
-- existing row and every month it carries comes with it.
--
-- The duplicates 0022 allowed have to go before the narrower constraint can be
-- added. For each report and name, the row carrying figures wins; if neither
-- does, the one that is not 'Unassigned' wins; failing that, the older id.
-- Nothing with data is discarded — the ordering exists precisely so that the
-- row somebody typed into survives the row that was created by the bug.

with ranked as (
  select
    id,
    row_number() over (
      partition by report_id, btrim(name)
      order by
        (m01 + m02 + m03 + m04 + m05 + m06
         + m07 + m08 + m09 + m10 + m11 + m12) desc,
        (u01 + u02 + u03 + u04 + u05 + u06
         + u07 + u08 + u09 + u10 + u11 + u12) desc,
        (category <> 'Unassigned') desc,
        id
    ) as rn
  from public.project_report_items
)
delete from public.project_report_items i
using ranked
where ranked.id = i.id
  and ranked.rn > 1;

alter table public.project_report_items
  drop constraint if exists project_report_items_report_category_name_key;

alter table public.project_report_items
  drop constraint if exists project_report_items_report_id_name_key;

alter table public.project_report_items
  add constraint project_report_items_report_id_name_key
  unique (report_id, name);
