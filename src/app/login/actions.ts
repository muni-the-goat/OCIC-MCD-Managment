"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

export type LoginResult =
  | { id: string; status: "success"; next: string }
  | {
      id: string;
      status: "error";
      message: string;
      field?: "email" | "password" | "credentials";
    };

export async function login(formData: FormData): Promise<LoginResult> {
  const id = crypto.randomUUID();
  const failure = (
    message: string,
    field?: "email" | "password" | "credentials"
  ): LoginResult => ({ id, status: "error", message, field });
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return failure(
      "Enter your email and password to continue.",
      !email ? "email" : "password"
    );
  }
  if (!z.email().safeParse(email).success) {
    return failure("Enter a valid office email address.", "email");
  }

  // Office accounts only. Checked before the credentials are sent so a
  // personal address is never attempted against Supabase Auth.
  if (!isAllowedEmail(email)) {
    return failure(
      `Use your ${ALLOWED_EMAIL_DOMAIN} office email address.`,
      "email"
    );
  }

  // Counted before the credentials are sent, so a locked address costs an
  // attacker a round trip to our database rather than a guess against Supabase.
  const key = await attemptKey(email);
  if ((await recentFailures(key)) >= MAX_FAILURES) {
    return failure(LOCKED_MESSAGE);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.status && error.status >= 500) {
        return failure(
          "Sign-in is temporarily unavailable. Please try again in a moment."
        );
      }
      await recordFailure(key);

      // A rate limit needs recovery guidance, not an incorrect-password message.
      const rateLimited =
        error.status === 429 || /rate limit/i.test(error.message ?? "");
      const locked =
        rateLimited || (await recentFailures(key)) >= MAX_FAILURES;

      return failure(
        locked
          ? LOCKED_MESSAGE
          : "Your email or password is incorrect. Check your details and try again.",
        locked ? undefined : "credentials"
      );
    }

    if (!data.user || !data.session) {
      return failure("We couldn’t complete your sign-in. Please try again.");
    }

    await clearFailures(key);
    // Return only after Auth has established the session. The form can show a
    // real success state before navigating; a URL flag must never imply success.
    return { id, status: "success", next: next ?? "/dashboard" };
  } catch {
    return failure("We couldn’t connect to sign you in. Please try again.");
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
