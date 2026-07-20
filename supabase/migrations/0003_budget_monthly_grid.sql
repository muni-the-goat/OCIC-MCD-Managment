-- Restructure budget_items for the monthly-grid budget format (matches the
-- department "Actual Expense" spreadsheet: freeform sections, a line-item name,
-- and one amount per calendar month across the fiscal year).
--
-- Safe to run as-is: there is no budget data yet. Run once in the Supabase SQL
-- editor after 0002. (Fresh setups run 0001 → 0002 → 0003 in order.)

alter table public.budget_items rename column category to section;
alter table public.budget_items alter column section set default '';

alter table public.budget_items add column name text not null default '';

alter table public.budget_items drop column if exists description;
alter table public.budget_items drop column if exists amount;

alter table public.budget_items
  add column m01 numeric(14, 2) not null default 0,
  add column m02 numeric(14, 2) not null default 0,
  add column m03 numeric(14, 2) not null default 0,
  add column m04 numeric(14, 2) not null default 0,
  add column m05 numeric(14, 2) not null default 0,
  add column m06 numeric(14, 2) not null default 0,
  add column m07 numeric(14, 2) not null default 0,
  add column m08 numeric(14, 2) not null default 0,
  add column m09 numeric(14, 2) not null default 0,
  add column m10 numeric(14, 2) not null default 0,
  add column m11 numeric(14, 2) not null default 0,
  add column m12 numeric(14, 2) not null default 0;
