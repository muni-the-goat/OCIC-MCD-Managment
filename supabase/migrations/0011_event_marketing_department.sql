-- Add Event Marketing to the department list.
--
-- This is the growth path 0010 was shaped for: widening a check constraint is a
-- plain transactional statement, where `alter type ... add value` on an enum
-- would not be. Drop and re-add rather than patch, so the constraint always
-- reads as the whole current list.
--
-- Mirror in src/lib/types.ts (DEPARTMENTS) — change both together. Existing
-- department values are untouched, so no data migration is needed.

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
      'event_marketing',
      'admin_hr'
    )
  );
