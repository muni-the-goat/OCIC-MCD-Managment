"use server";

import { redirect } from "next/navigation";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmail,
  safeNextPath,
} from "@/lib/login-rules";
import {
  LOCKED_MESSAGE,
  MAX_FAILURES,
  attemptKey,
  clearFailures,
  recentFailures,
  recordFailure,
} from "@/lib/login-throttle";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect("/login?error=Please+enter+your+email+and+password");
  }

  // Office accounts only. Checked before the credentials are sent so a
  // personal address is never attempted against Supabase Auth.
  if (!isAllowedEmail(email)) {
    const params = new URLSearchParams({
      error: `Sign in with your ${ALLOWED_EMAIL_DOMAIN} office account`,
    });
    if (next) params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  // Counted before the credentials are sent, so a locked address costs an
  // attacker a round trip to our database rather than a guess against Supabase.
  const key = await attemptKey(email);
  if ((await recentFailures(key)) >= MAX_FAILURES) {
    const params = new URLSearchParams({ error: LOCKED_MESSAGE });
    if (next) params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordFailure(key);

    // Supabase applies its own limit on the token endpoint. Reporting that as
    // "Invalid email or password" tells a rate-limited person their password is
    // wrong when it may well be right, and sends them to change a password that
    // was never the problem.
    const rateLimited =
      error.status === 429 || /rate limit/i.test(error.message ?? "");
    const locked =
      rateLimited || (await recentFailures(key)) >= MAX_FAILURES;

    const params = new URLSearchParams({
      error: locked ? LOCKED_MESSAGE : "Invalid email or password",
    });
    if (next) params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  // Proving you hold the password clears what the wrong guesses before it
  // counted.
  await clearFailures(key);
  redirect(next ?? "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
