-- The Vice President stops reading the marketing department's reports.
--
-- 0017 put them in the privileged tier on the reasoning that they outrank a Head
-- of Department, so they should be able to do everything one can. That described
-- the org chart rather than the job. The VP's reporting is the projects side —
-- sales, leasing, property management — and the marketing department's monthly
-- spend was never something they read. Reach nobody uses is not seniority; it is
-- surface area, and on a table holding every department's spend it is the kind
-- of surface area worth removing.
--
-- What they keep: account management. Inviting people and assigning roles is an
-- org-chart authority rather than a reporting one, and it lives entirely in the
-- Server Actions behind the service-role client — there is no policy here to
-- change for it.
--
-- What they lose with the reports: the approved annual budget. That figure is
-- the denominator for spend they can no longer see, and signing off a number you
-- have no view of is a formality rather than an authority. Enforced in
-- setBudgetApproval(), which is a service-role write with no policy either.
--
-- The whole change is three function bodies. Every report policy written since
-- 0017 calls public.is_privileged() rather than spelling out a role list, so
-- narrowing the function narrows `reports: select`, `reports: delete`,
-- `reports: privileged update`, `reports: review submitted`,
-- `comments: delete own or privileged`, can_view_report(), can_edit_report(),
-- review_report() and enforce_report_review_transition() at once. That is what
-- the 0017 refactor was for, and this is the first migration to collect on it.

create or replace function public.is_privileged()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.user_role()::text, '') in (
    'admin',
    'head_of_department'
  );
$$;

-- Both project-report predicates named is_privileged() in 0018, which as of the
-- statement above would have locked the Vice President out of the very reports
-- this migration exists to leave them. They now name their roles outright.
--
-- A Head of Department is not here, and that is the separation running both
-- ways: the marketing side and the projects side do not read each other. An
-- Admin sees both, because an Admin runs the system rather than either half of
-- it.
create or replace function public.reads_project_reports()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.user_role()::text, '') in (
    'admin',
    'vice_president',
    'vp_assistant'
  );
$$;

create or replace function public.writes_project_reports()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.user_role()::text, '') in (
    'admin',
    'vice_president',
    'vp_assistant'
  );
$$;

-- Note on what is deliberately NOT changed: a Vice President can still grant
-- roles, so they could grant themselves Head of Department and read everything
-- this migration just took away. That is not an oversight — it is inherent to
-- holding account management, exactly as it is for a Head of Department, and the
-- point of the boundary is that crossing it is a visible act recorded on a
-- profile rather than a quiet one. Only the Admin role is guarded harder, in
-- guardGrantedRole() and guardTarget().
