-- Seed: Marketing Communication (KTI) monthly activity report, April 2026
-- Source: "April2026-Marcom-KTI copy.pdf", prepared by Heng Sokchea and
-- Duong Senghon, dated 11 May 2026.
--
-- This is DATA, not schema. Like actual_expenses_2026.sql it lives outside
-- supabase/migrations so it is never mistaken for schema history and never
-- auto-applied. Run it by hand in the Supabase SQL editor.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN THIS — ONE EDIT REQUIRED
-- ---------------------------------------------------------------------------
-- A report belongs to a person, and the dashboard files it under whatever
-- department that person's profile carries. The PDF names two preparers but a
-- report has one author_id, so pick the account that should own it and put its
-- email in the seed_author block below. The other preparer is credited in the
-- summary text instead.
--
-- The department badge follows the author's profile, not this file. If the
-- report should read "Marketing Communication-KTI", that department must exist
-- and be assigned to the chosen account on the Users page first — otherwise
-- the report simply shows under whatever department the account already has.
--
-- ---------------------------------------------------------------------------
-- WHAT IS AND IS NOT IN HERE
-- ---------------------------------------------------------------------------
-- Nothing is invented. Two gaps in the source are worth knowing about:
--
-- 0. TASKS AND METRICS ARE NO LONGER READ. The app dropped the structured task
--    list and the per-platform figures from the monthly activity report — see
--    PROGRESS.md. The `tasks` and `metrics` keys below are still written, and
--    are still a faithful transcription of the PDF, but nothing displays them
--    and saving the report through the UI rewrites `content` without them.
--    They are kept so the figures survive for whenever the feature returns.
--
-- 1. TASKS. The PDF itemises four tasks (section 2) and names two content
--    pieces in its achievements text. It does NOT name the individual 13
--    content pieces behind the pie chart — only their counts by format. Seven
--    tasks are seeded rather than twenty. Add the missing content pieces from
--    the team's content calendar once their titles are known; the counts to
--    reach are 5 reel/video, 4 photo album, 4 story.
--
-- 2. TIKTOK. Two bars in the TikTok chart have labels truncated to "TOTAL …"
--    in the source (values 140 and 6). They are left out rather than guessed.
--
-- Per-platform post counts are the sums of that platform's own bars:
-- Facebook 2+5+4 = 11, Instagram 2+4+4 = 10, TikTok 4, LinkedIn 0. The 13
-- unique pieces are cross-posted, which is why these sum to more than 13.
--
-- LinkedIn carries "posts": 0 and nothing else. That is deliberate and is the
-- reason metric maps are sparse: 0 is a measured zero, an absent key is not
-- measured, and LinkedIn published nothing in April. Storing the rest as 0
-- would invent seven data points.
--
-- Section 4 of the PDF reads "Budget Spent: None", so no budget report is
-- created here. Do not add an empty one — a zero budget report and an unfiled
-- one look identical on the dashboard, and only the second is true.
--
-- ---------------------------------------------------------------------------
-- Safe to re-run. The report created here is tagged in content->>'seed' and
-- removed at the start of each run; nothing else is ever touched.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Who owns the report  <-- EDIT THE EMAIL ON THE NEXT LINE
-- ---------------------------------------------------------------------------

create temporary table seed_author on commit drop as
select id
from public.profiles
where lower(email) = lower('CHANGE-ME@ocic.com.kh')
limit 1;

do $$
begin
  if not exists (select 1 from seed_author) then
    raise exception
      'No profile matches the email at the top of this file. Replace CHANGE-ME@ocic.com.kh with an existing account, then re-run.';
  end if;
end $$;

-- Clear a previous run before checking for clashes, so re-running is not
-- itself reported as a conflict.
delete from public.reports
where content->>'seed' = 'marcom-kti-april-2026';

-- A second April 2026 activity report for the same author is almost certainly
-- this report filed by hand. Stop rather than create a duplicate that would
-- double-count every task on the dashboard.
do $$
declare
  v_existing text;
begin
  select coalesce(p.full_name, p.email) into v_existing
  from public.reports r
  join seed_author a on a.id = r.author_id
  join public.profiles p on p.id = r.author_id
  where r.type = 'monthly'
    and r.period_year = 2026
    and r.period_month = 4
  limit 1;

  if v_existing is not null then
    raise exception
      '% already has a monthly activity report for April 2026. Delete it, or choose a different account, then re-run.',
      v_existing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The report
-- ---------------------------------------------------------------------------

insert into public.reports (
  author_id, type, budget_period, title,
  period_month, period_year, status, content,
  reviewed_by, reviewed_at, created_at, updated_at
)
select
  a.id,
  'monthly',
  'annual',                       -- unused for activity reports; column is not null
  'Marketing Communication — KTI',
  4,                              -- the period covered (1–30 April), NOT the
  2026,                           -- 11 May preparation date on the cover
  'reviewed',
  jsonb_build_object(
    'seed', 'marcom-kti-april-2026',
    'source', 'April2026-Marcom-KTI copy.pdf',

    'summary',
      'Reporting period 1–30 April 2026. Prepared by Heng Sokchea and Duong Senghon.' || E'\n\n' ||
      '13 pieces of content were produced (5 reel/video, 4 photo album, 4 story) and cross-posted across Facebook, Instagram and TikTok. ' ||
      'The month''s headline finding is that quality outperformed volume: the Blessing Ceremony and International Labor Day posts drove a marked rise in engagement, link clicks, interactions and visit rate despite a limited number of posts overall. ' ||
      'Facebook views and visits fell against the previous period (-28.8% and -37.5%), but engagement rate rose 152.3% and link clicks 372.4%. Instagram views rose 51.0% and engagement rate 282.4%. TikTok reach rose 453.4%.' || E'\n\n' ||
      'No budget was spent this month.',

    'accomplishments',
      'Content published — Facebook 11, Instagram 10, TikTok 4, LinkedIn 0. Formats produced: 5 reel/video, 4 photo album, 4 story.' || E'\n\n' ||
      'Media engagement — Local: Khmer Times, Cambodia Investment Review. ' ||
      'International: The Straits Times, Honeycombers Singapore, The Moodie Davitt Report, Travel and Tour World, Trip.com.' || E'\n\n' ||
      'Platform figures are recorded in the social performance table on this report rather than repeated here.',

    'challenges',
      'Coordination: budget approval remains unresolved due to unclear reporting lines, leading to repeated review cycles between OCIC and CAIC.' || E'\n\n' ||
      'Equipment and manpower: insufficient manpower and inadequate equipment have resulted in delays to routine support, causing setbacks in implementation.' || E'\n\n' ||
      'Team: after a multimedia team member underperformed and was let go, the marketing executive has absorbed the additional workload. The team is packed with strategy, partnerships with airlines, magazines and vendors, and meetings, and barely manages to do design, photoshoots or video for social media platforms.',

    'next_month_plan',
      'Goals: Prix Versailles support; corporate video for KTI; Francophonie Expo; International Children''s Day campaign.' || E'\n\n' ||
      'To improve collaboration and efficiency, especially with the CAIC team and in support of the airport strategy:' || E'\n' ||
      '- Establish a clear reporting line and develop a transparent organisational chart.' || E'\n' ||
      '- Define roles and expectations for every project, especially regarding data collection and dashboard development.' || E'\n' ||
      '- Schedule regular planning and alignment sessions between Marcomm and CAIC.' || E'\n' ||
      '- Simplify internal processes such as payment workflows and approval chains, to reduce friction and keep vendors satisfied.' || E'\n' ||
      '- Utilise collaborative platforms so all stakeholders including CAIC stay informed and involved.' || E'\n' ||
      '- Advocate for the airport strategy to be clearly documented and shared, so Marcomm can align campaign activities with the broader goals.' || E'\n' ||
      '- Encourage CAIC to allow greater involvement from Marcomm during benchmarking and dashboard development.',

    -- Section 2 of the PDF, plus the two content pieces its achievements text
    -- names. See the note at the top: the other 11 pieces are not itemised in
    -- the source and are deliberately not invented here.
    'tasks', jsonb_build_array(
      jsonb_build_object('name', 'Meeting with Cambodia Tourism Board',                'type', 'other'),
      jsonb_build_object('name', 'Support Prix Versailles preparation',               'type', 'event_campaign'),
      jsonb_build_object('name', 'Shooting and produce International Labor Day content', 'type', 'video_photo'),
      jsonb_build_object('name', 'Support Lucky Draw event and handover',             'type', 'event_campaign'),
      jsonb_build_object('name', 'Blessing Ceremony content',                         'type', 'content_design'),
      jsonb_build_object('name', 'Local media engagement — Khmer Times, Cambodia Investment Review', 'type', 'other'),
      jsonb_build_object('name', 'International media engagement — 5 outlets',        'type', 'other')
    ),

    -- Sections 1.1.2 and 1.2.1–1.2.3, current period only. The percentage
    -- changes in the source are against March and are carried in the summary
    -- text; only the current-period figures are stored as data.
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'platform', 'facebook',
        'values', jsonb_build_object(
          'posts', 11,
          'views', 123167,
          'interactions', 3060,
          'visits', 60937,
          'follows', 469,
          'link_clicks', 274,
          'engagement_rate', 5.02,
          'visit_rate', 21.19
        )
      ),
      jsonb_build_object(
        'platform', 'instagram',
        'values', jsonb_build_object(
          'posts', 10,
          'views', 16200,
          'interactions', 542,
          'visits', 347,
          'follows', 50,
          'engagement_rate', 20.84,
          'follow_rate', 14.41
        )
      ),
      jsonb_build_object(
        'platform', 'tiktok',
        'values', jsonb_build_object(
          'posts', 4,
          'views', 4871,
          'reach', 10853,
          'profile_views', 285,
          'likes', 124,
          'follows', 32,
          'shares', 10
        )
      ),
      -- A measured zero, not an absence. See the note at the top of this file.
      jsonb_build_object(
        'platform', 'linkedin',
        'values', jsonb_build_object('posts', 0)
      )
    )
  ),
  (select id from public.profiles where role = 'admin' order by created_at limit 1),
  -- The cover date of the PDF, so the timeline reads like a real filing.
  timestamptz '2026-05-11 00:00:00+07',
  timestamptz '2026-05-11 00:00:00+07',
  timestamptz '2026-05-11 00:00:00+07'
from seed_author a;

commit;

-- ---------------------------------------------------------------------------
-- To undo:
--   delete from public.reports where content->>'seed' = 'marcom-kti-april-2026';
-- ---------------------------------------------------------------------------
