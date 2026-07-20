import { InviteUserDialog } from "@/components/invite-user-dialog";
import {
  DeleteUserButton,
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
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const me = await requireRole("admin", "coordinator");
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  const users = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Invite office members and manage their roles."
              : "View office members and reset eligible user passwords."}
          </p>
        </div>
        {isAdmin ? <InviteUserDialog /> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isMe = user.id === me.id;
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
                      disabled={isMe || !isAdmin}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isMe ? null : (
                      <span className="inline-flex items-center gap-1">
                        {isAdmin ||
                        (user.role !== "admin" &&
                          user.role !== "head_of_department") ? (
                          <ResetPasswordButton userId={user.id} />
                        ) : null}
                        {isAdmin ? (
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
