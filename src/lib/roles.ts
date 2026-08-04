import type { AppRole } from "@/lib/types";

// Pure policy: who may do what, as a function of role alone. Deliberately free
// of any server import so client components can ask the same questions the
// server does — src/lib/auth.ts reads the session and re-exports all of this,
// and importing that from a client component would drag the Supabase server
// client into the browser bundle.
//
// None of this is enforcement. Every answer here is also enforced in a Server
// Action and, where the data allows, in a Row Level Security policy.

// The office hierarchy, most senior first:
//
//   Admin > Vice President > Head of Department > VP Assistant > Coordinator
//         > Manager > Staff
//
// Used for "may this account act on that one" — you reach accounts at or below
// your own rank, never above. It is seniority, not capability, and the two come
// apart in both directions: a Coordinator ranks above a Manager and still cannot
// edit anyone's report, and a VP Assistant ranks above a Coordinator while
// holding no decision power at all. Capability is the predicates below.
const RANK: Record<AppRole, number> = {
  admin: 6,
  vice_president: 5,
  head_of_department: 4,
  vp_assistant: 3,
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

// Authority over the *marketing department's* reporting: reading every report,
// deciding on them, editing and deleting them. Admin and Head of Department.
//
// The Vice President was here from 0017 until 0019, on the reasoning that they
// outrank a Head of Department and so should be able to do everything one can.
// That turned out to describe the org chart rather than the job. The VP's
// reporting is the projects side — sales, leasing, property management — and the
// marketing department's monthly spend was never something they read. Giving
// them reach they never use is not seniority, it is just surface area.
//
// They keep account management (canManageUsers below names them explicitly),
// because inviting and assigning people is an org-chart authority rather than a
// reporting one. They lost the approved annual budget with the reports it
// measures: setting a figure you cannot see the spend against is a signature on
// a document you are not shown.
//
// One exception remains inside this pair: canResetPasswords() excludes a Head of
// Department. It stays its own function so the exception is visible rather than
// scattered.
export function isPrivileged(role: AppRole) {
  return role === "admin" || role === "head_of_department";
}

// Reads every report in the office, of either type, without deciding on any.
//
// Only the privileged tier now. The VP Assistant briefly had this in 0017, when
// the role was "reads the whole office and decides nothing"; 0018 narrowed them
// to the projects side once it became clear the three project reports *are* the
// job. They compile those and read no marketing report but their own.
export function seesAllReports(role: AppRole) {
  return isPrivileged(role);
}

// ---------------------------------------------------------------------------
// The projects side
//
// Sales, leasing and property management across OCIC's projects. A different
// subject from the rest of this file, which is all about the marketing
// department's own reporting, and deliberately its own pair of predicates
// rather than another clause bolted onto the ones above.
// ---------------------------------------------------------------------------

// The two sides of the office do not read each other. A Head of Department is
// absent here for the same reason the Vice President is absent from the
// marketing predicates above: the separation runs both ways. An Admin sees
// everything, because an Admin runs the system.
export function seesProjectReports(role: AppRole) {
  return (
    role === "admin" || role === "vice_president" || role === "vp_assistant"
  );
}

// Compiling the figures. The VP Assistant does the work; the Vice President and
// an Admin can correct it. The same set that reads them — there is no one who
// can see a project report and not fix a number in it.
export function canEditProjectReports(role: AppRole) {
  return seesProjectReports(role);
}

// Neither the Vice President nor their Assistant has any marketing reporting, so
// the office dashboard, the Reports list and the two MCD report forms would all
// be empty or refused for them. They land on the projects dashboard instead and
// are never shown those tabs.
//
// This is about *reporting*, not about the whole application: a Vice President
// still manages accounts, so the Users link survives this on its own predicate.
export function livesOnProjectsOnly(role: AppRole) {
  return role === "vice_president" || role === "vp_assistant";
}

// Holds some decision power over a submitted report, which is what earns the
// dashboard's pending-review queue. Not the same as holding both
// powers — a Coordinator approves but cannot reject, so the two capabilities
// below are asked separately everywhere it matters.
//
// A Manager is deliberately excluded: they see only their own reports, so any
// decision control would have nothing in reach.
export function isReviewer(role: AppRole) {
  return canMarkReviewed(role) || canRejectReport(role);
}

// Whether this role's report list contains other people's reports, and so needs
// the Author and Department columns and the author filter. Deliberately not the
// same question as isReviewer(): "sees someone else's report" and "decides on
// it" came apart when the Coordinator arrived and again with the VP Assistant,
// who reads the whole office and decides on none of it.
export function seesOtherAuthors(role: AppRole) {
  return isReviewer(role) || seesAllBudgetReports(role);
}

// A Coordinator's cross-office visibility stops at budget reports. Monthly
// activity reports stay private to their author and the review chain — migration
// 0012 is the enforcement; this only decides how the page describes itself.
export function seesAllBudgetReports(role: AppRole) {
  return seesAllReports(role) || role === "coordinator";
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
// a department. The Vice President is named explicitly rather than through
// isPrivileged(): they manage the office's people without reading its reports,
// which is the whole shape of the role after 0019.
export function canManageUsers(role: AppRole) {
  return isPrivileged(role) || role === "vice_president";
}

// Accounts a Coordinator may not reset the password of. Exactly the set that can
// manage users, which is the point — a Coordinator who could reset the password
// of anyone able to grant roles has a route to any role they like. This tracks
// canManageUsers() rather than restating a list, so the two cannot drift.
export function isProtectedAccount(role: AppRole) {
  return canManageUsers(role);
}

// The one thing a Head of Department or Vice President cannot do. A Coordinator
// can, for the non-privileged roles only — that narrowing lives in the server
// action, which is the only place that can see who the target is.
export function canResetPasswords(role: AppRole) {
  return role === "admin" || role === "coordinator";
}

// Who may reach the Users page at all. A Manager is included for read-only
// access — they see the office directory but every control is disabled and every
// server action refuses them, so they can neither manage accounts nor reset a
// password. Staff still cannot open the page, and neither can a VP Assistant:
// the office directory is part of the marketing side they no longer inhabit.
export function canOpenUsersPage(role: AppRole) {
  return canManageUsers(role) || canResetPasswords(role) || role === "manager";
}

// Everyone who reads budgets beyond their own, plus the Manager reading their
// own. Written against seesAllBudgetReports() rather than a role list so the
// card and annualBudgetScope() below cannot disagree about who is looking at it.
export function canViewAnnualBudget(role: AppRole) {
  return seesAllBudgetReports(role) || role === "manager";
}

// Setting the approved annual budget. The Head of Department alone — the only
// capability in this file that an Admin does not have.
//
// That is deliberate and was asked for explicitly. Approving a budget is a
// financial authority, not an administrative one: an Admin runs the system, and
// running the system is not the same as deciding what the office may spend. An
// Admin can still read the figure, and can still grant themselves the Head of
// Department role if they genuinely need to change it — the point is that doing
// so is a visible act rather than a quiet one.
//
// The Vice President held this briefly, between 0017 and 0019. It went back when
// they stopped reading the marketing department's reports: the approved budget
// is the denominator for spend they can no longer see, and signing off a figure
// you have no view of is not authority, it is a formality.
export function canSetBudgetApproval(role: AppRole) {
  return role === "head_of_department";
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
//   all — every author in the office (Admin, Vice President, Head of
//         Department, VP Assistant, Coordinator)
//   own — the signed-in user alone (Manager)
//
// Staff never reach this: canViewAnnualBudget() gates the card first.
export type AnnualBudgetScope = "all" | "own";

export function annualBudgetScope(role: AppRole): AnnualBudgetScope {
  return seesAllBudgetReports(role) ? "all" : "own";
}
