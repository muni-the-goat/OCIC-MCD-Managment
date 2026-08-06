import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Counting failed sign-ins, so that guessing a password gets slower and the
// person doing the guessing is told something true about why.
//
// The service-role client writes this. The table denies everyone else, so
// nothing here is reachable from a browser — see 0026 for why that is the
// shape rather than a policy letting anonymous callers insert.

// Eight wrong passwords from one place inside a quarter of an hour is not
// somebody misremembering; it is somebody trying combinations. A person who has
// genuinely forgotten waits fifteen minutes or asks for a reset, which is what
// the message tells them to do.
export const MAX_FAILURES = 8;
export const WINDOW_MINUTES = 15;

export const LOCKED_MESSAGE =
  "Too many failed sign-in attempts. Wait 15 minutes and try again, or ask a coordinator or an administrator to reset your password.";

function windowStart() {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
}

// The address the request came from, as the proxy reported it. Spoofable by
// anyone who can set a header, which is why it only ever groups attempts: a
// forged value buys an attacker a fresh count, never somebody else's lockout.
async function clientAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || list.get("x-real-ip")?.trim() || "unknown";
}

export interface AttemptKey {
  email: string;
  ip: string;
}

export async function attemptKey(email: string): Promise<AttemptKey> {
  return { email: email.trim().toLowerCase(), ip: await clientAddress() };
}

// How many failures this address has against this address-book entry inside the
// window. A database that is unreachable returns 0 rather than throwing: a
// throttle that has lost its memory should let people in, not lock the office
// out of its own reporting.
export async function recentFailures(key: AttemptKey): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", key.email)
      .eq("ip", key.ip)
      .gte("failed_at", windowStart());

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function recordFailure(key: AttemptKey): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("login_attempts")
      .insert({ email: key.email, ip: key.ip });
    // Yesterday's failures are nobody's business and no use to the count. The
    // prune rides along with the write so the table has no separate schedule to
    // forget about.
    await supabase
      .from("login_attempts")
      .delete()
      .lt("failed_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
  } catch {
    // A throttle that cannot record is a throttle that does not throttle. It is
    // not a reason to refuse a sign-in that Supabase Auth has already accepted.
  }
}

// Signing in successfully clears the count. Otherwise six wrong tries, a
// correct one, and two more wrong ones would lock an account that its owner has
// just proved they hold.
export async function clearFailures(key: AttemptKey): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("login_attempts")
      .delete()
      .eq("email", key.email)
      .eq("ip", key.ip);
  } catch {
    // As above.
  }
}
