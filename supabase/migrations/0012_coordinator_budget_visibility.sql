-- Coordinators oversee office spend, so they see every budget report across the
-- office. Monthly activity reports stay private to their author and the review
-- chain — a Coordinator sees only their own.
--
-- This is read-only visibility. can_edit_report() is deliberately untouched, so
-- a Coordinator can open someone else's budget report, its line items, its
-- comments and its attachments, and change none of them. Review authority is
-- unchanged too: marking reviewed stays with Admin and Head of Department, and
-- rejecting stays with Admin, Head of Department and Manager.
--
-- Drafts remain private, exactly as they are for a Manager or Head of
-- Department. A draft is a working copy, not a submission.

create or replace function public.can_view_report(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = rid
      and (
        r.author_id = auth.uid()
        or public.user_role()::text = 'admin'
        or (
          public.user_role()::text in ('manager', 'head_of_department')
          and r.status <> 'draft'
        )
        or (
          public.user_role()::text = 'coordinator'
          and r.type = 'budget'
          and r.status <> 'draft'
        )
      )
  );
$$;

grant execute on function public.can_view_report(uuid) to authenticated;

-- budget_items, report_comments, report_attachments and the storage bucket all
-- gate on can_view_report(), so widening it above is what actually lets a
-- Coordinator read the numbers. This policy is the reports table's own select.
drop policy if exists "reports: select" on public.reports;
create policy "reports: select" on public.reports
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.user_role()::text = 'admin'
    or (
      public.user_role()::text in ('manager', 'head_of_department')
      and status <> 'draft'
    )
    or (
      public.user_role()::text = 'coordinator'
      and type = 'budget'
      and status <> 'draft'
    )
  );
