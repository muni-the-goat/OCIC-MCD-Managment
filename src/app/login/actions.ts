"use server";

import { redirect } from "next/navigation";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmail,
  safeNextPath,
} from "@/lib/login-rules";
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: "Invalid email or password" });
    if (next) params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  redirect(next ?? "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
