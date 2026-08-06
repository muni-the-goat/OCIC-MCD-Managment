-- Somewhere to count failed sign-ins, so guessing a password gets slower.
--
-- There was no throttle of our own before this. Supabase Auth applies its own
-- limit on the token endpoint, per IP and generously — enough to stop a script
-- hammering it, not enough to notice somebody working through a colleague's
-- likely passwords. Worse, the login action turned every error it got into
-- "Invalid email or password", so a rate-limited user was told their password
-- was wrong when it may well have been right.
--
-- Rows are keyed by email *and* by the address the attempt came from. Counting
-- by email alone would let anyone lock a colleague out of their own account by
-- failing on it a few times on purpose — a denial of service handed to the
-- first person who noticed. Counting the pair means an attacker's failures
-- count against the attacker.
--
-- The service role writes this and nothing else touches it: RLS is on and the
-- table has no policies at all, which denies every signed-in and anonymous
-- client by default. That is deliberate. The alternative — a policy letting
-- anonymous callers insert — would be an unauthenticated write endpoint on the
-- public internet, added to defend against unauthenticated writes.

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  -- Lower-cased by the caller. Not a foreign key to profiles: an attempt on an
  -- address that has no account is exactly the case worth counting, and a
  -- reference would also make this table say which addresses are real.
  email text not null,
  -- Whatever the proxy reported, or 'unknown' when it reported nothing. Never
  -- trusted for anything but grouping.
  ip text not null default 'unknown',
  failed_at timestamptz not null default now()
);

create index if not exists login_attempts_lookup
  on public.login_attempts (email, ip, failed_at desc);

alter table public.login_attempts enable row level security;

-- Attempts are pruned by the action that writes them; this index keeps that
-- delete from scanning the table once it has been running a while.
create index if not exists login_attempts_failed_at
  on public.login_attempts (failed_at);
