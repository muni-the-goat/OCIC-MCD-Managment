import { AddDepartmentDialog } from "@/components/add-department-dialog";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import {
  DeleteUserButton,
  DepartmentSelect,
  ResetPasswordButton,
  RoleSelect,
} from "@/components/user-row-actions";
import {
  canManageUsers,
  canOpenUsersPage,
  canResetPasswords,
  getProfile,
  isProtectedAccount,
} from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const me = await getProfile();
  if (!canOpenUsersPage(me.role)) redirect("/dashboard");

  const manages = canManageUsers(me.role);
  const resets = canResetPasswords(me.role);
  // Only an Admin may create or promote to Admin, or touch an Admin account.
  // Without that, "a Head of Department or Vice President cannot reset
  // passwords" would be one promotion away from meaningless.
  const isAdmin = me.role === "admin";

  const supabase = await createClient();
  const [{ data }, departments] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    getDepartments(),
  ]);
  const users = (data ?? []) as Profile[];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <p className="type-eyebrow">
            {users.length} {users.length === 1 ? "person" : "people"}
          </p>
          <h1 className="type-title">Users</h1>
          <p className="type-subtitle">
            {manages
              ? "Invite office members and manage their roles and departments."
              : resets
                ? "View office members and reset eligible user passwords."
                : "View office members."}
          </p>
        </div>
        {manages ? (
          // Pills at the page's button size. Their dialogs portal out of this
          // box, so the sizing never reaches the buttons inside them.
          <div className="flex flex-wrap items-center gap-2 [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]]:px-5 [&_[data-slot=button]]:text-[0.9375rem] [&_[data-slot=button]]:font-semibold [&_[data-variant=outline]]:border-transparent [&_[data-variant=outline]]:bg-card [&_[data-variant=outline]]:shadow-none">
            <AddDepartmentDialog />
            <InviteUserDialog
              departments={departments}
              canGrantAdmin={isAdmin}
            />
          </div>
        ) : null}
      </header>

      {/* A list of people rather than a table of fields. Each row leads with
          who the person is — initials, name, email — and the controls that
          change them follow, wrapping under the name when the row is narrow
          instead of pushing the page sideways. The table this replaces
          scrolled horizontally at every width below a large monitor, with
          Delete off the right edge. */}
      <ul className="overflow-hidden rounded-[1.25rem] bg-card">
        {users.map((user) => {
          const isMe = user.id === me.id;
          // A Head of Department or Vice President manages everyone below
          // them, but never an Admin — that account is out of reach.
          const locked = !manages || (!isAdmin && user.role === "admin");
          const name = user.full_name || user.email;
          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5 [&+li]:border-t [&+li]:border-border/70"
            >
              <div className="flex min-w-0 flex-1 basis-64 items-center gap-3.5">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-[0.875rem] font-semibold text-muted-foreground"
                >
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <p className="type-headline flex items-center gap-2">
                    <span className="truncate">{user.full_name || "—"}</span>
                    {isMe ? (
                      <span className="type-caption shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="type-callout truncate text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-[3.375rem] sm:pl-0">
                <RoleSelect
                  userId={user.id}
                  name={name}
                  role={user.role}
                  disabled={isMe || locked}
                  canGrantAdmin={isAdmin}
                />
                {/* A Coordinator sees the list but assigns nothing, so they
                    get the department as words rather than a dead control. */}
                {locked ? (
                  <span className="type-callout px-3.5 text-muted-foreground">
                    {departmentLabel(user.department, departments) ??
                      "Unassigned"}
                  </span>
                ) : (
                  <DepartmentSelect
                    userId={user.id}
                    department={user.department}
                    departments={departments}
                  />
                )}
              </div>

              <span className="type-caption hidden w-24 text-right text-muted-foreground tabular-nums xl:block">
                Joined{" "}
                {new Date(user.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>

              {isMe ? (
                // Holds the column so the rows below stay aligned.
                <span className="hidden w-[15.5rem] lg:block" aria-hidden />
              ) : (
                <div className="flex items-center gap-1 pl-[3.375rem] sm:pl-0 lg:w-[15.5rem] lg:justify-end">
                  {resets && (isAdmin || !isProtectedAccount(user.role)) ? (
                    <ResetPasswordButton userId={user.id} name={name} />
                  ) : null}
                  {manages && !locked ? (
                    <DeleteUserButton userId={user.id} label={name} />
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function initials(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
