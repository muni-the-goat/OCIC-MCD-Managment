import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

// Returns the signed-in user's profile, or redirects to /login.
// cache() dedupes the lookup across layout + page within one request.
export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return profile as Profile;
});

// Role guard for pages and server actions. Never trust the client.
export async function requireRole(...roles: AppRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!roles.includes(profile.role)) redirect("/dashboard");
  return profile;
}

export function isReviewer(role: AppRole) {
  return (
    role === "admin" || role === "head_of_department" || role === "manager"
  );
}

export function canMarkReviewed(role: AppRole) {
  return role === "head_of_department";
}

export function canRejectReport(role: AppRole) {
  return isReviewer(role);
}
