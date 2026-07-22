import type { AppRole } from "@/lib/types";

// Pure policy: who may do what, as a function of role alone. Deliberately free
// of any server import so client components can ask the same questions the
// server does — src/lib/auth.ts reads the session and re-exports all of this,
// and importing that from a client component would drag the Supabase server
// client into the browser bundle.
//
// None of this is enforcement. Every answer here is also enforced in a Server
// Action and, where the data allows, in a Row Level Security policy.

// The office hierarchy, most powerful first:
//
//   Admin > Head of Department > Coordinator > Manager > Staff
//
// Used for "may this account act on that one" — you reach accounts at or below
// your own rank, never above. It is not a general capability ordering: a
// Coordinator ranks above a Manager and still cannot edit anyone's report.
const RANK: Record<AppRole, number> = {
  admin: 4,
  head_of_department: 3,
  coordinator: 2,
  manager: 1,
  staff: 0,
};

export function roleRank(role: AppRole) {
  return RANK[role];
}

export function outranksOrEquals(actor: AppRole, target: AppRole) {
  return RANK[actor] >= RANK[target];
}

// Admin and Head of Department are equivalent everywhere except one place:
// resetting a password, which only canResetPasswords() grants. Every other
// "can they do the powerful thing" question routes through here, so the single
// exception stays visible instead of scattered across a dozen checks.
export function isPrivileged(role: AppRole) {
  return role === "admin" || role === "head_of_department";
}

// Holds some decision power over a submitted report, which is what earns the
// pending-review queue and the Author column. Not the same as holding both
// powers — a Coordinator approves but cannot reject, so the two capabilities
// below are asked separately everywhere it matters.
//
// A Manager is deliberately excluded: they see only their own reports, so any
// decision control would have nothing in reach.
export function isReviewer(role: AppRole) {
  return canMarkReviewed(role) || canRejectReport(role);
}

// Whether this role's report list contains other people's reports, and so needs
// the Author and Department columns and the author filter. Currently the same
// set as isReviewer(), and kept separate anyway: "sees someone else's report"
// and "decides on it" are different questions that have come apart before and
// will again.
export function seesOtherAuthors(role: AppRole) {
  return isReviewer(role) || seesAllBudgetReports(role);
}

// A Coordinator's cross-office visibility stops at budget reports. Monthly
// activity reports stay private to their author and the review chain — migration
// 0012 is the enforcement; this only decides how the page describes itself.
export function seesAllBudgetReports(role: AppRole) {
  return isPrivileged(role) || role === "coordinator";
}

// Approving. A Coordinator may approve, including their own report — they are
// the office's budget oversight, and a budget they can already read across every
// team is a budget they can sign off.
export function canMarkReviewed(role: AppRole) {
  return isPrivileged(role) || role === "coordinator";
}

// Rejecting, which sends a report back with required feedback. Reserved to the
// Head of Department and the Admin above them: it is the one decision that
// creates work for someone else.
export function canRejectReport(role: AppRole) {
  return isPrivileged(role);
}

// What a Coordinator may decide on, given they only ever see budget reports plus
// their own. Enforced in the `reports: review submitted` policy; this keeps the
// detail page from offering a control the database would refuse.
export function canDecideOnReport(
  role: AppRole,
  reportType: "budget" | "monthly",
  isAuthor: boolean
) {
  if (!isReviewer(role)) return false;
  if (role === "coordinator") return reportType === "budget" || isAuthor;
  return true;
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
// Everyone who reads every team's budget gets it, which is the same set as
// seesAllBudgetReports() — a roll-up of data you can already read line by line
// gives nothing away. A Manager is excluded because their matrix would be a
// single column of their own figures.
export function canViewDepartmentMatrix(role: AppRole) {
  return seesAllBudgetReports(role);
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
