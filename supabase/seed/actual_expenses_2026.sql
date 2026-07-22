-- Seed: Actual Expenses 2026, January–June
-- Source: "Actual Expenses 2026 (Summary (Printing)).csv", the team's own workbook.
--
-- This is DATA, not schema. It deliberately lives outside supabase/migrations so
-- it is never mistaken for schema history and never auto-applied. Run it by hand
-- in the Supabase SQL editor.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN THIS
-- ---------------------------------------------------------------------------
-- Every figure lands in the department of the person who filed the report, so
-- this seed needs one account per department, assigned on the Users page:
--
--   Sheet block          Department assigned to that account
--   -------------------  -----------------------------------
--   PR / Communication   Brand Marketing        (brand_marketing)
--   Event                Event Marketing        (event_marketing)
--   Digital              Digital Marketing      (digital_marketing)
--   Multimedia           Multimedia             (multimedia)
--   Coordination         Admin/HR               (admin_hr)      <- see note
--   CSR, Partnership     Partnership Marketing  (partnership_marketing)
--   Products             — no spend in 2026, nothing seeded
--
-- If several accounts share a department the oldest one is used.
--
-- NOTE ON "Coordination": the sheet's Coordination block has no matching entry
-- in DEPARTMENTS. Its contents are petty cash, office expense, online tools and
-- subscriptions, so it is seeded as Admin/HR. If Coordination should be its own
-- department, add it to DEPARTMENTS in src/lib/types.ts, widen the check
-- constraint in a new migration, and change 'admin_hr' below to the new id.
--
-- ---------------------------------------------------------------------------
-- KNOWN GAP IN THE SOURCE — READ THIS
-- ---------------------------------------------------------------------------
-- Multimedia's January does not add up in the source workbook. Its itemised
-- rows give $24.90 (MicroTek Battery UPS) but its own TOTAL row, and the
-- summary matrix, both say $387.90 — a difference of exactly $363.00, which is
-- also the Dell Monitor figure sitting in February.
--
-- Nothing is invented here. Only the itemised rows are seeded, so after this
-- runs Multimedia will read $24.90 for January and $4,878.88 for the year,
-- against $387.90 and $5,241.88 in the workbook. Every other department
-- reconciles to the cent. Add the missing January line item once you know what
-- it was.
--
-- ---------------------------------------------------------------------------
-- Safe to re-run. Reports created by this seed are tagged in content->>'seed'
-- and removed at the start of each run; nothing else is ever touched.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Preconditions
-- ---------------------------------------------------------------------------

do $$
declare
  v_missing text;
begin
  select string_agg(d, ', ' order by d) into v_missing
  from unnest(array[
    'brand_marketing',
    'event_marketing',
    'digital_marketing',
    'multimedia',
    'admin_hr',
    'partnership_marketing'
  ]) as d
  where not exists (
    select 1 from public.profiles p where p.department = d
  );

  if v_missing is not null then
    raise exception
      'No account is assigned to: %. Assign one account per department on the Users page, then re-run.',
      v_missing;
  end if;
end $$;

-- The oldest account in each department owns that department's reports.
create temporary table seed_author on commit drop as
select distinct on (department) department, id
from public.profiles
where department in (
  'brand_marketing',
  'event_marketing',
  'digital_marketing',
  'multimedia',
  'admin_hr',
  'partnership_marketing'
)
order by department, created_at;

-- Clear a previous run before checking for clashes, so re-running is not itself
-- reported as a conflict.
delete from public.reports
where content->>'seed' = 'actual-expenses-2026';

-- One monthly budget per author per period is enforced by a database trigger.
-- Fail with a readable message rather than letting that trigger fire mid-insert
-- and leave the question of what got in unanswered.
do $$
declare
  v_clash text;
begin
  select string_agg(
           format('%s — %s/2026', coalesce(p.full_name, p.email), r.period_month),
           ', ' order by r.period_month
         )
    into v_clash
  from public.reports r
  join seed_author a on a.id = r.author_id
  join public.profiles p on p.id = r.author_id
  where r.type = 'budget'
    and r.budget_period = 'monthly'
    and r.period_year = 2026
    and r.period_month between 1 and 6;

  if v_clash is not null then
    raise exception
      'These accounts already have a 2026 monthly budget in January–June: %. Delete those reports, or assign a different account to that department, then re-run.',
      v_clash;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The workbook, transcribed
--
-- One row per (department, section, line item, month) that has spend. Months
-- with no spend produce no report — an empty report is a filing that never
-- happened. Line-item names are verbatim from the sheet apart from the typo
-- fixes listed at the end of this file; section names are normalised, because
-- the sheet's "Categorise" column holds several values in one cell.
-- ---------------------------------------------------------------------------

create temporary table seed_row (
  dept    text          not null,
  block   text          not null,
  section text          not null,
  item    text          not null,
  month   int           not null,
  amount  numeric(14,2) not null
) on commit drop;

insert into seed_row (dept, block, section, item, month, amount) values
  -- PR / Communication -> Brand Marketing -------------------------------------
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 1, 835.00),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 2, 187.00),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 3, 1454.20),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 4, 1831.40),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 5, 1171.20),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Press Release', 6, 4476.60),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Media Package', 2, 360.00),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Media Package', 3, 1460.00),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Media Package', 4, 540.00),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Media Package', 5, 956.66),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Media Package', 6, 748.33),
  ('brand_marketing', 'PR / Communication', 'PR / Communication', 'Others', 5, 100.00),

  -- Event -> Event Marketing --------------------------------------------------
  ('event_marketing', 'Event', 'Corporate Event', 'Booth Production, Lunar New Year', 2, 1600.00),
  ('event_marketing', 'Event', 'Corporate Event', 'Staff Standby Allowance', 2, 125.00),
  ('event_marketing', 'Event', 'Materials', 'Walkie Talkie', 3, 300.00),
  ('event_marketing', 'Event', 'Materials', 'Red Carpet', 3, 1085.00),
  ('event_marketing', 'Event', 'Materials', 'HDMI', 3, 28.00),
  ('event_marketing', 'Event', 'Corporate Event', 'Booth Production, Nokor Songkran', 4, 2320.00),
  ('event_marketing', 'Event', 'Materials', 'LED Light', 4, 26.50),
  ('event_marketing', 'Event', 'Materials', 'Bolt and Nut', 4, 1.50),
  ('event_marketing', 'Event', 'Materials', 'Wet Wipes', 4, 11.34),
  ('event_marketing', 'Event', 'Materials', 'Red Tapes', 4, 45.00),
  ('event_marketing', 'Event', 'Materials', 'Display Stand', 4, 4.20),
  ('event_marketing', 'Event', 'Corporate Event', 'Extension Cable, Pithi Film Screening', 4, 100.00),
  ('event_marketing', 'Event', 'Materials', 'Red Carpet (100SQM)', 5, 310.00),
  ('event_marketing', 'Event', 'Materials', 'Tape (Red & Black)', 5, 50.00),
  ('event_marketing', 'Event', 'Materials', 'Curtain', 5, 90.00),
  ('event_marketing', 'Event', 'Materials', 'Extension Cable & More Tapes', 5, 50.00),
  ('event_marketing', 'Event', 'Corporate Event', 'Renting Podium', 5, 50.00),
  ('event_marketing', 'Event', 'Corporate Event', 'Back Drop Printing (DFC Event)', 6, 300.00),
  ('event_marketing', 'Event', 'Corporate Event', 'Real Flower (DFC Event)', 6, 50.00),
  ('event_marketing', 'Event', 'Materials', 'Desk Flags, Name Plates and Tapes', 6, 21.40),
  ('event_marketing', 'Event', 'Corporate Event', 'Renting Furniture for MOU event', 6, 312.00),

  -- Digital -> Digital Marketing ----------------------------------------------
  -- YouTube and Telegram are tracked in the sheet but were never spent on, so
  -- they produce no rows here.
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 1, 131.94),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 2, 252.49),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 3, 323.43),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 4, 138.69),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 5, 164.86),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Facebook', 6, 75.06),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Instagram', 2, 38.08),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Instagram', 3, 194.51),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Instagram', 4, 202.52),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Instagram', 5, 21.89),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'Instagram', 6, 74.50),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'LinkedIn', 1, 252.00),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'LinkedIn', 2, 219.87),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'LinkedIn', 3, 494.81),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'LinkedIn', 4, 219.86),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'LinkedIn', 5, 219.50),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 1, 77.73),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 2, 116.02),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 3, 76.99),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 4, 226.63),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 5, 19.43),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'TikTok', 6, 185.19),
  ('digital_marketing', 'Digital', 'Social Media Ads', 'X', 5, 48.00),
  ('digital_marketing', 'Digital', 'Others Expenses', 'Khmer New Year Video Production', 4, 572.87),

  -- Multimedia -> Multimedia --------------------------------------------------
  -- January is $24.90 here, not the $387.90 the workbook totals claim. See the
  -- KNOWN GAP note at the top of this file.
  ('multimedia', 'Multimedia', 'Software', 'Adobe Creative Cloud all apps 3 accounts = 6 devices', 3, 68.99),
  ('multimedia', 'Multimedia', 'Software', 'Adobe Creative Cloud all apps 3 accounts = 6 devices', 6, 59.99),
  ('multimedia', 'Multimedia', 'New Equipment', 'MicroTek Battery UPS 12V, 8.2A (3pcs)', 1, 24.90),
  ('multimedia', 'Multimedia', 'New Equipment', 'Dell Monitor 4k 1pcs (For Theara)', 2, 363.00),
  ('multimedia', 'Multimedia', 'New Equipment', '1 x Camera Sony A7M5 (Body)', 5, 2367.00),
  ('multimedia', 'Multimedia', 'New Equipment', '1x Sony FE 24-70mm f2.8 GM II (Lens)', 5, 1455.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'Battery FE 24-70mm f2.8 GMII', 5, 60.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'NiSi True Color ND-VARIO 1-5stops 82mm', 5, 121.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'Sony Tough G 64GB 300/299', 5, 202.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'SmallRig 4064B Compact V-Mount Battery', 5, 77.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'Godox S2-Bracket Ring for Round Flash V1', 5, 36.00),
  ('multimedia', 'Multimedia', 'New Equipment', 'Meking Tutu-3528S Stainless Stand 2.8m', 5, 44.00),

  -- Coordination -> Admin/HR --------------------------------------------------
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 1, 109.13),
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 2, 277.30),
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 3, 236.30),
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 4, 170.93),
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 5, 215.40),
  ('admin_hr', 'Coordination', 'Office Expense', 'Petty Cash', 6, 223.84),
  ('admin_hr', 'Coordination', 'Office Expense', 'Office Expense (OCIC Wall)', 3, 874.06),
  ('admin_hr', 'Coordination', 'Office Expense', 'Computer (Hardware, Software, Fixing)', 5, 168.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'Weglot', 1, 588.26),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 1, 20.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 2, 20.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 3, 20.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 4, 20.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 5, 22.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'ChatGPT', 6, 22.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 1, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 2, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 3, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 4, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 5, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'CapCut', 6, 6.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'Envato', 3, 198.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'iCloud Drive', 1, 2.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'iCloud Drive', 3, 2.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'iCloud Drive', 4, 2.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'iCloud Drive', 5, 2.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'iCloud Drive', 6, 2.99),
  ('admin_hr', 'Coordination', 'Online Tools', 'Webflow/Website', 4, 28.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'Webflow/Website', 5, 28.00),
  ('admin_hr', 'Coordination', 'Online Tools', 'Webflow/Website', 6, 28.00),
  ('admin_hr', 'Coordination', 'Other Expenses', 'HELP. SKILLSHARE.COM', 1, 38.30),
  ('admin_hr', 'Coordination', 'Other Expenses', 'HELP. SKILLSHARE.COM', 2, 2.99),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 1, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 2, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 3, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 4, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 5, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google GSUITE_canadiaimpa', 6, 6.93),
  ('admin_hr', 'Coordination', 'Other Expenses', 'SSLS.COM', 2, 192.65),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google One', 4, 21.99),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google One', 5, 21.99),
  ('admin_hr', 'Coordination', 'Other Expenses', 'Google One', 6, 21.99),
  ('admin_hr', 'Coordination', 'Other Expenses', 'CLAUDE.AI Subscription', 5, 200.00),

  -- CSR, Partnership -> Partnership Marketing ---------------------------------
  -- The workbook shows the April figure in the summary matrix only; there is no
  -- detail block behind it, so it is seeded as a single unitemised line.
  ('partnership_marketing', 'CSR / Partnership', 'CSR / Partnership', 'Not itemised in source sheet', 4, 3582.00);

-- ---------------------------------------------------------------------------
-- 3. Reports — one per department per month that has spend
-- ---------------------------------------------------------------------------

create temporary table seed_report (
  id           uuid not null,
  author_id    uuid not null,
  period_month int  not null
) on commit drop;

with periods as (
  select distinct dept, block, month from seed_row
),
inserted as (
  insert into public.reports (
    author_id, type, budget_period, title,
    period_month, period_year, status, content,
    reviewed_by, reviewed_at, created_at, updated_at
  )
  select
    a.id,
    'budget',
    'monthly',
    p.block || ' — ' || to_char(make_date(2026, p.month, 1), 'FMMonth') || ' 2026',
    p.month,
    2026,
    'reviewed',
    jsonb_build_object(
      'seed', 'actual-expenses-2026',
      'source', 'Actual Expenses 2026 (Summary (Printing)).csv'
    ),
    (select id from public.profiles where role = 'admin' order by created_at limit 1),
    -- Dated just after the period rather than today, so the timeline reads like
    -- a filing history instead of thirty reports all landing this afternoon.
    make_date(2026, p.month, 1) + interval '1 month 5 days',
    make_date(2026, p.month, 1) + interval '1 month',
    make_date(2026, p.month, 1) + interval '1 month 5 days'
  from periods p
  join seed_author a on a.department = p.dept
  returning id, author_id, period_month
)
insert into seed_report (id, author_id, period_month)
select id, author_id, period_month from inserted;

-- ---------------------------------------------------------------------------
-- 4. Line items — the amount lands in the m-column matching the report's period
-- ---------------------------------------------------------------------------

insert into public.budget_items (
  report_id, section, name, sort_order,
  m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12
)
select
  r.id,
  s.section,
  s.item,
  (row_number() over (partition by r.id order by s.section, s.item))::int - 1,
  case when s.month =  1 then s.amount else 0 end,
  case when s.month =  2 then s.amount else 0 end,
  case when s.month =  3 then s.amount else 0 end,
  case when s.month =  4 then s.amount else 0 end,
  case when s.month =  5 then s.amount else 0 end,
  case when s.month =  6 then s.amount else 0 end,
  0, 0, 0, 0, 0, 0
from seed_row s
join seed_author a on a.department = s.dept
join seed_report r on r.author_id = a.id and r.period_month = s.month;

commit;

-- ---------------------------------------------------------------------------
-- 5. Verification — compare this against the summary sheet
--
-- Expected department totals:
--   Brand Marketing (Comm)        14,120.39
--   Event Marketing                6,879.94
--   Digital Marketing              4,346.87
--   Multimedia                     4,878.88   (workbook says 5,241.88 — see note)
--   Admin/HR (Coordination)        3,867.60
--   Partnership Marketing          3,582.00
--   -------------------------------------
--   Total                         37,675.68   (workbook says 38,038.68)
-- ---------------------------------------------------------------------------

select
  coalesce(p.department, 'unassigned') as department,
  round(sum(b.m01), 2) as jan,
  round(sum(b.m02), 2) as feb,
  round(sum(b.m03), 2) as mar,
  round(sum(b.m04), 2) as apr,
  round(sum(b.m05), 2) as may,
  round(sum(b.m06), 2) as jun,
  round(sum(b.m01 + b.m02 + b.m03 + b.m04 + b.m05 + b.m06), 2) as total
from public.budget_items b
join public.reports r on r.id = b.report_id
join public.profiles p on p.id = r.author_id
where r.type = 'budget'
  and r.budget_period = 'monthly'
  and r.status = 'reviewed'
  and r.period_year = 2026
group by rollup (coalesce(p.department, 'unassigned'))
order by department nulls last;

-- ---------------------------------------------------------------------------
-- Changes made to the source text, all of them typo fixes. Line-item names are
-- matched as normalised text when the annual summary aggregates, so seeding a
-- misspelling would guarantee a mismatch the first time someone types it
-- correctly.
--
--   "Adobe Creative Clound"  -> "Adobe Creative Cloud"
--   "iCould Drive"           -> "iCloud Drive"
--   "Office Expense (OCIC Wall"  -> "Office Expense (OCIC Wall)"   (unclosed)
--   "Cooporate Event"        -> "Corporate Event"                  (section)
--
-- Section names are normalised because the sheet's "Categorise" column holds
-- several values in one cell. Four Event rows carry both categories and were
-- filed under the dominant one:
--   Booth Production, Lunar New Year        -> Corporate Event
--   Extension Cable, Pithi Film Screening   -> Corporate Event
--   Red Carpet                              -> Materials
--   Desk Flags, Name Plates and Tapes       -> Materials
-- ---------------------------------------------------------------------------
