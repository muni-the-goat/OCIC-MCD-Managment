"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  inviteUser,
  type UserActionState,
} from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/types";

// Matches the sentinel the server action expects; Radix Select cannot carry an
// empty-string value.
const UNASSIGNED = "unassigned";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    inviteUser,
    null
  );

  const success = state && "success" in state ? state : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="size-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            Creates the account immediately with a temporary password — no
            email is sent. Share the password with them securely.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>{success.success}</AlertDescription>
            </Alert>
            {success.tempPassword ? (
              <p className="select-all rounded-md border bg-muted p-3 text-center font-mono text-sm">
                {success.tempPassword}
              </p>
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state && "error" in state ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" name="full_name" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select name="role" defaultValue="staff">
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="head_of_department">
                    Head of Department
                  </SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-department">Department</Label>
              <Select name="department" defaultValue={UNASSIGNED}>
                <SelectTrigger id="invite-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
