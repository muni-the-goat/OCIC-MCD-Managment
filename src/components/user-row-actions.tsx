"use client";

import { useActionState, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import {
  deleteUser,
  resetUserPassword,
  updateUserDepartment,
  updateUserRole,
  type UserActionState,
} from "@/app/(app)/admin/users/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToasts } from "@/components/use-action-toasts";
import type { DepartmentRecord } from "@/lib/departments";
import type { AppRole, Department } from "@/lib/types";

// Radix Select forbids an empty-string item value, and the server needs to tell
// "clear the department" apart from "field missing", so both ends agree on a
// sentinel instead.
const UNASSIGNED = "unassigned";

export function RoleSelect({
  userId,
  role,
  disabled,
  canGrantAdmin = true,
}: {
  userId: string;
  role: AppRole;
  disabled?: boolean;
  // A Head of Department cannot grant Admin. The option stays visible when the
  // account already holds it, so the select can still show its current value.
  canGrantAdmin?: boolean;
}) {
  const [state, formAction] = useActionState<UserActionState, FormData>(
    updateUserRole,
    null
  );
  useActionToasts(state);

  return (
    <Select
      value={role}
      disabled={disabled}
      onValueChange={(newRole) => {
        const formData = new FormData();
        formData.set("user_id", userId);
        formData.set("role", newRole);
        formAction(formData);
      }}
    >
      <SelectTrigger className="w-48" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="staff">Staff</SelectItem>
        <SelectItem value="manager">Manager</SelectItem>
        <SelectItem value="head_of_department">Head of Department</SelectItem>
        <SelectItem value="coordinator">Coordinator</SelectItem>
        {canGrantAdmin || role === "admin" ? (
          <SelectItem value="admin">Admin</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}

export function DepartmentSelect({
  userId,
  department,
  departments,
  disabled,
}: {
  userId: string;
  department: Department | null;
  departments: DepartmentRecord[];
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<UserActionState, FormData>(
    updateUserDepartment,
    null
  );
  useActionToasts(state);

  return (
    <Select
      value={department ?? UNASSIGNED}
      disabled={disabled}
      onValueChange={(next) => {
        const formData = new FormData();
        formData.set("user_id", userId);
        formData.set("department", next);
        formAction(formData);
      }}
    >
      <SelectTrigger className="w-52" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {departments.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            {entry.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    resetUserPassword,
    null
  );
  useActionToasts(state, (s) => setTempPassword(s.tempPassword ?? null));

  return (
    <>
      <form action={formAction} className="inline">
        <input type="hidden" name="user_id" value={userId} />
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={pending}
          title="Reset password"
        >
          <KeyRound className="size-4" />
          Reset password
        </Button>
      </form>
      <Dialog
        open={tempPassword !== null}
        onOpenChange={(open) => !open && setTempPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share it with the user securely — it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <p className="select-all rounded-md border bg-muted p-3 text-center font-mono text-sm">
            {tempPassword}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTempPassword(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteUserButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    deleteUser,
    null
  );
  useActionToasts(state, () => setOpen(false));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>
              Their account and all reports they authored (including
              attachments and comments) will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="user_id" value={userId} />
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete user"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
