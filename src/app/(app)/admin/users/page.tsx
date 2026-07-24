import { AddDepartmentDialog } from "@/components/add-department-dialog";
import { DepartmentBadge } from "@/components/department-badge";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import {
  DeleteUserButton,
  DepartmentSelect,
  ResetPasswordButton,
  RoleSelect,
} from "@/components/user-row-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  canManageUsers,
  canOpenUsersPage,
  canResetPasswords,
  getProfile,
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
  // Without that, "a Head of Department cannot reset passwords" would be one
  // promotion away from meaningless.
  const isAdmin = me.role === "admin";

  const supabase = await createClient();
  const [{ data }, departments] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    getDepartments(),
  ]);
  const users = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {manages
              ? "Invite office members and manage their roles and departments."
              : resets
                ? "View office members and reset eligible user passwords."
                : "View office members."}
          </p>
        </div>
        {manages ? (
          <div className="flex flex-wrap items-center gap-2">
            <AddDepartmentDialog />
            <InviteUserDialog
              departments={departments}
              canGrantAdmin={isAdmin}
            />
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isMe = user.id === me.id;
              // A Head of Department manages everyone below them, but never an
              // Admin — that account is out of reach entirely.
              const locked = !manages || (!isAdmin && user.role === "admin");
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || "—"}
                    {isMe ? (
                      <Badge variant="outline" className="ml-2">
                        You
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <RoleSelect
                      userId={user.id}
                      role={user.role}
                      disabled={isMe || locked}
                      canGrantAdmin={isAdmin}
                    />
                  </TableCell>
                  <TableCell>
                    {/* A Coordinator sees the table but assigns nothing, so they
                        get the chip rather than a dead control. */}
                    {locked ? (
                      <DepartmentBadge
                        label={departmentLabel(user.department, departments)}
                      />
                    ) : (
                      <DepartmentSelect
                        userId={user.id}
                        department={user.department}
                        departments={departments}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMe ? null : (
                      <span className="inline-flex items-center gap-1">
                        {resets &&
                        (isAdmin ||
                          (user.role !== "admin" &&
                            user.role !== "head_of_department")) ? (
                          <ResetPasswordButton userId={user.id} />
                        ) : null}
                        {manages && !locked ? (
                          <DeleteUserButton
                            userId={user.id}
                            label={user.full_name || user.email}
                          />
                        ) : null}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
