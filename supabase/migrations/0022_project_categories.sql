-- Every project report gains the same four headings.
--
-- The sales report already read Land / House / Condo, and the Vice President
-- asked for that shape everywhere: the same four categories across the top of
-- every table — Land, House, Condo, Commercial — with the individual units
-- beneath whichever one they belong to. The Elysee is not a column in its own
-- right; it is a building inside a category.
--
-- This is the `section` column that budget_items has carried since 0001, and
-- 0018 deliberately left out on the grounds that a project report was one flat
-- list of names. That was true of the workbook and is not true of how the
-- office wants to read it, so the level comes back.
--
-- Uniqueness moves with it. Two categories may legitimately hold a unit of the
-- same name — a "Phase 1" under Land and a "Phase 1" under Condo are different
-- things — so the key is (report_id, category, name) rather than name alone.
--
-- Existing rows:
--
--   Sales      known exactly. The rows *are* the categories — Land, House,
--              Condo, and CCB's "Commercial Building" — so each maps to itself
--              and "Commercial Building" is renamed to match the shared vocabulary.
--   Leasing    not known, and not guessed. Which category The Elysee, Night
--   and PM     Market or Connexion Hub belongs to is a fact about OCIC's
--              portfolio, not something derivable from a spreadsheet, so those
--              rows land in 'Unassigned' and stay visibly so until somebody who
--              knows sets them from the Project report form. A wrong category
--              printed in a document presented to the Chairwoman is worse than
--              an obviously empty one.

alter table public.project_report_items
  add column if not exists category text not null default 'Unassigned';

-- Dropped first so a second run of this file does not fail on a constraint it
-- created itself; these migrations are pasted into the SQL editor by hand.
alter table public.project_report_items
  drop constraint if exists project_report_items_category_check;

alter table public.project_report_items
  add constraint project_report_items_category_check
  check (char_length(btrim(category)) between 1 and 40);

-- The sales rows are the categories, so each one names itself.
update public.project_report_items i
set category = case i.name
      when 'Commercial Building' then 'Commercial'
      else i.name
    end,
    name = case i.name
      when 'Commercial Building' then 'Commercial'
      else i.name
    end
from public.project_reports r
where r.id = i.report_id
  and r.stream = 'sales'
  and i.name in ('Land', 'House', 'Condo', 'Commercial Building');

-- Uniqueness now spans the category.
alter table public.project_report_items
  drop constraint if exists project_report_items_report_id_name_key;

alter table public.project_report_items
  drop constraint if exists project_report_items_report_category_name_key;

alter table public.project_report_items
  add constraint project_report_items_report_category_name_key
  unique (report_id, category, name);

-- ===========================================================================
-- Commercial joins the Koh Pich sales report
--
-- Asked for explicitly, and empty is fine — the four headings are meant to be
-- the same on every table whether or not a given project sold into all four
-- this year. An all-zero row renders as a column of em dashes, which reads as
-- "nothing sold" rather than as "$0.00 sold", and that is the honest shape of a
-- category a project has not traded in.
--
-- Chroy Changvar Bay already has its Commercial row from its own workbook.
-- ===========================================================================

insert into public.project_report_items (report_id, category, name, sort_order)
select r.id, 'Commercial', 'Commercial', 40
from public.project_reports r
where r.project_id = 'koh_pich'
  and r.stream = 'sales'
on conflict (report_id, category, name) do nothing;

-- Sort order follows the shared vocabulary, so the four read the same way on
-- every table regardless of which project or year is on screen.
update public.project_report_items i
set sort_order = case i.category
      when 'Land' then 10
      when 'House' then 20
      when 'Condo' then 30
      when 'Commercial' then 40
      else 90
    end
from public.project_reports r
where r.id = i.report_id
  and r.stream = 'sales';

create index if not exists project_report_items_category_idx
  on public.project_report_items (report_id, category, sort_order);
