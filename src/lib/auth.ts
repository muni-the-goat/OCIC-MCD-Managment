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

// Whether this role's report list contains other people's reports, and so needs
// the Author and Department columns and the author filter. Deliberately not the
// same question as isReviewer(): a Coordinator sees every budget report in the
// office but decides on none of them, so folding them into the reviewer check
// would hand them a review queue they cannot act on.
export function seesOtherAuthors(role: AppRole) {
  return isReviewer(role) || role === "coordinator";
}

// A Coordinator's cross-office visibility stops at budget reports. Monthly
// activity reports stay private to their author and the review chain — this
// mirrors the `reports: select` policy added in migration 0012, which is the
// enforcement; this function only decides how the page describes itself.
export function seesAllBudgetReports(role: AppRole) {
  return role === "admin" || role === "coordinator";
}

export function canMarkReviewed(role: AppRole) {
  return role === "admin" || role === "head_of_department";
}

export function canRejectReport(role: AppRole) {
  return isReviewer(role);
}

export function canViewAnnualBudget(role: AppRole) {
  return (
    role === "admin" ||
    role === "head_of_department" ||
    role === "manager" ||
    role === "coordinator"
  );
}

// The department × month matrix that sits above the per-author budget grids.
// Narrower than canViewAnnualBudget() on purpose: it is an office-wide
// cross-department roll-up, which is a Head of Department's and an Admin's view
// of the org. A Manager sees only their own figures, so a matrix would be one
// column, and a Coordinator's budget access is for oversight of the individual
// reports rather than for reading the org chart off the spend.
export function canViewDepartmentMatrix(role: AppRole) {
  return role === "admin" || role === "head_of_department";
}

// How wide the annual budget summary reaches. One function rather than a pair of
// role booleans because the query scope, the author filter and the card's own
// description all have to agree, and they drifted apart the last time each
// answered the question for itself.
//
//   all      — every author in the office (Admin, Coordinator)
//   managers — authors whose role is manager (Head of Department)
//   own      — the signed-in user alone (Manager)
//
// Staff never reach this: canViewAnnualBudget() gates the card first.
export type AnnualBudgetScope = "all" | "managers" | "own";

export function annualBudgetScope(role: AppRole): AnnualBudgetScope {
  if (seesAllBudgetReports(role)) return "all";
  if (role === "head_of_department") return "managers";
  return "own";
}
