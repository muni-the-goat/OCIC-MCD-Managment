-- PR / Communication changes hands: Jeriko Enriquez to Monyrath Hor.
--
-- Jeriko filed the FY2026 PR / Communication budget while it sat under Brand
-- Marketing. The work is Monyrath's now, and the reporting has to follow it —
-- otherwise every figure in that section keeps being counted against Brand
-- Marketing, which is the department that did not spend it.
--
-- One column does the whole job. Spend is attributed through
-- reports.author_id, and the department shown against it is read off that
-- author's *current* profile at render time rather than stored on the report —
-- the same rule that already lets someone's history follow them when they
-- change team. So moving the author moves the total, the per-month chart, the
-- line items, the department badge and the department x month matrix together,
-- with nothing left pointing at the old owner.
--
-- What deliberately does not move:
--
--   reviewed_by / reviewed_at   who approved it, and when. That happened.
--   report_comments.author_id   whoever wrote a comment still wrote it.
--   attachments.uploaded_by     likewise, and their storage paths are keyed on
--                               report_id, which does not change — so no file
--                               has to be touched or re-uploaded.
--
-- Status is untouched, so all six stay 'reviewed' and none needs re-approving.
-- reports_enforce_review_transition only fires when status changes, and 0016
-- dropped the one-budget-per-period trigger, so neither stands in the way.
--
-- Idempotent: once the rows have moved, author_id no longer matches and a
-- second run changes nothing.

update public.reports
set author_id = 'd829157f-cdb4-493b-85d4-e4652b41c3f5'  -- Monyrath Hor
where author_id = '0f62fbf5-8c5c-422a-b545-b16290967ee7' -- Jeriko Enriquez
  and type = 'budget'
  and period_year = 2026;

-- To reverse, swap the two ids above. The six reports are:
--   PR / Communication -- January..June 2026, all reviewed, $14,120.39 total.
