-- The Koh Pich portfolio gets its categories.
--
-- 0022 put every leasing and property-management unit in 'Unassigned' rather
-- than guess which of Land / House / Condo / Commercial each building belongs
-- to. The Vice President has now said:
--
--   The Elysée      Commercial
--   La Seine        House
--   Elite Cove      House
--   Elite Garden    House
--
-- Applied to both the leasing and the property-management reports, because
-- these are the same four buildings appearing in two reports about them — a
-- building does not change category depending on which sheet it is listed on.
--
-- Note on the name: the leasing report spells it "The Elysee" and the property
-- management report "The Elysée", straight from the two source workbooks. Both
-- are matched below so both get categorised. Neither is renamed — the same
-- building carrying two spellings is worth fixing, but renaming somebody's data
-- is a separate decision from categorising it, and it has not been asked for.
--
-- Still Unassigned after this, and deliberately: Night Market, Commercial Lease
-- and Connexion Hub on the Koh Pich leasing report, and 'External' on Chroy
-- Changvar Bay's. Their names suggest an answer and suggestion is not knowledge;
-- they stay visibly unassigned until someone says.

update public.project_report_items i
set category = 'Commercial'
from public.project_reports r
where r.id = i.report_id
  and r.project_id = 'koh_pich'
  and r.stream in ('leasing', 'property_management')
  and btrim(i.name) in ('The Elysée', 'The Elysee');

update public.project_report_items i
set category = 'House'
from public.project_reports r
where r.id = i.report_id
  and r.project_id = 'koh_pich'
  and r.stream in ('leasing', 'property_management')
  and btrim(i.name) in ('La Seine', 'Elite Cove', 'Elite Garden');

-- ===========================================================================
-- Diamond Bay Garden joins property management as a Condo
--
-- Added to both years so the row exists on the 2025 report as well as 2026 and
-- the year-on-year comparison has a column to line up rather than a gap that
-- appears from nowhere. No figures: the row is a heading waiting for months,
-- and an all-zero row renders as em dashes, which reads as "nothing reported"
-- rather than "nothing earned".
--
-- Property management only. It was asked for while looking at that report, and
-- putting a building on the leasing report as well would be inventing a second
-- fact from the one that was given.
-- ===========================================================================

insert into public.project_report_items (report_id, category, name, sort_order)
select r.id, 'Condo', 'Diamond Bay Garden', 10
from public.project_reports r
where r.project_id = 'koh_pich'
  and r.stream = 'property_management'
on conflict (report_id, category, name) do nothing;
