import type { AppRole } from "@/lib/types";

// Pure policy: who may do what, as a function of role alone. Deliberately free
// of any server import so client components can ask the same questions the
// server does — src/lib/auth.ts reads the session and re-exports all of this,
// and importing that from a client component would drag the Supabase server
// client into the browser bundle.
//
// None of this is enforcement. Every answer here is also enforced in a Server
// Action and, where the data allows, in a Row Level Security policy.

// Admin and Head of Department are equivalent everywhere except one place:
// resetting a password, which only canResetPasswords() grants. Every other
// "can they do the powerful thing" question routes through here, so the single
// exception stays visible instead of scattered across a dozen checks.
export function isPrivileged(role: AppRole) {
  return role === "admin" || role === "head_of_department";
}

// Deciding on a submitted report. A Manager is deliberately excluded: they no
// longer see anyone else's reports, so a reject button would have nothing in
// reach — the power and the visibility were removed together in migration 0013.
export function isReviewer(role: AppRole) {
  return isPrivileged(role);
}

// Whether this role's report list contains other people's reports, and so needs
// the Author and Department columns and the author filter. Not the same question
// as isReviewer(): a Coordinator sees every budget report in the office but
// decides on none of them, so folding them into the reviewer check would hand
// them a review queue they cannot act on.
export function seesOtherAuthors(role: AppRole) {
  return isReviewer(role) || role === "coordinator";
}

// A Coordinator's cross-office visibility stops at budget reports. Monthly
// activity reports stay private to their author and the review chain — migration
// 0012 is the enforcement; this only decides how the page describes itself.
export function seesAllBudgetReports(role: AppRole) {
  return isPrivileged(role) || role === "coordinator";
}

export function canMarkReviewed(role: AppRole) {
  return isPrivileged(role);
}

export function canRejectReport(role: AppRole) {
  return isPrivileged(role);
}

// Editing and deleting a report someone else authored, and the Reports page's
// bulk delete.
export function canManageAnyReport(role: AppRole) {
  return isPrivileged(role);
}

// Inviting accounts, changing roles and departments, deleting users, and adding
// a department.
export function canManageUsers(role: AppRole) {
  return isPrivileged(role);
}

// The one thing a Head of Department cannot do. A Coordinator can, for the
// non-privileged roles only — that narrowing lives in the server action, which
// is the only place that can see who the target is.
export function canResetPasswords(role: AppRole) {
  return role === "admin" || role === "coordinator";
}

// Who may reach the Users page at all.
export function canOpenUsersPage(role: AppRole) {
  return canManageUsers(role) || canResetPasswords(role);
}

export function canViewAnnualBudget(role: AppRole) {
  return isPrivileged(role) || role === "manager" || role === "coordinator";
}

// The department × month matrix that sits above the per-author budget grids.
// Narrower than canViewAnnualBudget() on purpose: it is an office-wide
// cross-department roll-up. A Manager sees only their own figures, so a matrix
// would be one column, and a Coordinator's budget access is for oversight of the
// individual reports rather than for reading the org chart off the spend.
export function canViewDepartmentMatrix(role: AppRole) {
  return isPrivileged(role);
}

// How wide the annual budget summary reaches. One function rather than a set of
// role booleans because the query scope, the author filter and the card's own
// description all have to agree, and they drifted apart the last time each
// answered the question for itself.
//
//   all — every author in the office (Admin, Head of Department, Coordinator)
//   own — the signed-in user alone (Manager)
//
// Staff never reach this: canViewAnnualBudget() gates the card first.
export type AnnualBudgetScope = "all" | "own";

export function annualBudgetScope(role: AppRole): AnnualBudgetScope {
  return seesAllBudgetReports(role) ? "all" : "own";
}
