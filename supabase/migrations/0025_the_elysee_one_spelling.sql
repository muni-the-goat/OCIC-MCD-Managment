-- One building, one spelling.
--
-- The Elysée is entered as "The Elysée" in the property management report and
-- "The Elysee" in the leasing one. Nothing was wrong with either figure, but a
-- unit's name is its identity as of 0024, so the two spellings are two
-- properties: the filter offered both, and picking one showed half the
-- building. The accented spelling wins because it is the building's name.
--
-- Matching is deliberately loose — case, spacing and the accent all set aside —
-- so a month typed as "the elysee" is caught by the same pass.

-- A report holding both spellings at once is a different problem: two rows of
-- real figures for one building, which could be a duplicate to merge or two
-- halves of a total to add, and nothing here can tell which. Renaming would
-- collide with the (report_id, name) key anyway, so stop and let somebody look
-- rather than guess with money.
do $$
declare
  clashes int;
begin
  select count(*) into clashes
  from (
    select report_id
    from public.project_report_items
    where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) in
      ('the elysée', 'the elysee')
    group by report_id
    having count(*) > 1
  ) both_spellings;

  if clashes > 0 then
    raise exception
      'One report holds both spellings of The Elysée (% report(s)). Merge them by hand before running this migration.',
      clashes;
  end if;
end $$;

update public.project_report_items
set name = 'The Elysée'
where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) in
  ('the elysée', 'the elysee')
  and name <> 'The Elysée';
