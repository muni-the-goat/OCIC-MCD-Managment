-- Assign each office member to a department.
--
-- A text column with a check constraint rather than an enum: departments are a
-- business list that will change more often than app_role, and `alter type ...
-- add value` cannot always run inside a transaction block, which makes enum
-- growth awkward under migration tooling. Widening a check constraint is a
-- plain transactional statement. The canonical list is mirrored in
-- src/lib/types.ts (DEPARTMENTS) — change both together.
--
-- Nullable, with no default. Existing accounts genuinely have no department
-- yet, and back-filling everyone into one would be inventing data. The UI
-- shows those rows as "Unassigned" until an Admin sets them.

alter table public.profiles
  add column if not exists department text;

alter table public.profiles
  drop constraint if exists profiles_department_check;

alter table public.profiles
  add constraint profiles_department_check check (
    department is null
    or department in (
      'digital_marketing',
      'multimedia',
      'brand_marketing',
      'product_marketing',
      'kti_marketing',
      'partnership_marketing',
      'admin_hr'
    )
  );

create index if not exists profiles_department_idx
  on public.profiles (department)
  where department is not null;

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Department is an assignment, not a preference: only an Admin may set it.
-- Read through a security definer function for the same reason user_role()
-- exists — a policy on profiles that sub-selects from profiles would recurse.
create or replace function public.user_department()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select department from public.profiles where id = auth.uid();
$$;

grant execute on function public.user_department() to authenticated;

-- Replace the self-update policy so it pins department the way it already pins
-- role. `is not distinct from` rather than `=` so a NULL department compares
-- correctly instead of making the whole predicate NULL and failing the write.
drop policy if exists "profiles: update own (no role change)" on public.profiles;
create policy "profiles: update own (no role or department change)"
  on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.user_role()
    and department is not distinct from public.user_department()
  );

-- The existing "profiles: admin all" policy already covers Admin writes, so
-- assigning a department needs no new policy.
