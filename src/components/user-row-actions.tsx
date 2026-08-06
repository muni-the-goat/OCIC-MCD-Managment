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
import { ActionButton, ActionMessage } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useActionToasts } from "@/components/use-action-toasts";
import type { DepartmentRecord } from "@/lib/departments";
import { isPrivileged } from "@/lib/roles";
import {
  ASSIGNABLE_ROLES,
  roleLabel,
  type AppRole,
  type Department,
} from "@/lib/types";

// Radix Select forbids an empty-string item value, and the server needs to tell
// "clear the department" apart from "field missing", so both ends agree on a
// sentinel instead.
const UNASSIGNED = "unassigned";

// What the confirm dialog tells you that you are about to hand over. Written
// per role rather than as one generic line, because "manage accounts" and "is
// the only role that can grant Admin" are different sizes of decision and the
// dialog is the last place either can be reconsidered.
function grantWarning(role: AppRole) {
  if (role === "admin") {
    return "An Admin has unrestricted control: they decide on any report, manage every account, reset passwords, and are the only role that can grant Admin to someone else.";
  }
  return `A ${roleLabel(role)} can mark reviewed or reject any report, edit and delete anyone's work, manage every account, and set the approved annual budget.`;
}

export function RoleSelect({
  userId,
  name,
  role,
  disabled,
  canGrantAdmin = true,
}: {
  userId: string;
  // For the confirm dialog. A role change is one of the few things here done
  // *to* a named person, and "Make Sokchea Heng a Vice President?" is a
  // question you can actually check against the row you meant to click.
  name: string;
  role: AppRole;
  disabled?: boolean;
  // A Head of Department cannot grant Admin. The option stays visible when the
  // account already holds it, so the select can still show its current value.
  canGrantAdmin?: boolean;
}) {
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    updateUserRole,
    null
  );
  // Two pieces of state rather than one nullable role, because Radix animates
  // the dialog closed: if confirming cleared the role, the fading panel would
  // re-render with nothing to name and flash "Make Sophal Chan a undefined?" on
  // the way out. `pendingRole` survives the close and is simply overwritten the
  // next time the dialog opens.
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null);
  const [confirming, setConfirming] = useState(false);
  useActionToasts(state);

  const submit = (next: AppRole) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("role", next);
    formAction(formData);
  };

  // Only a change that crosses the privileged boundary stops for confirmation.
  // Moving someone between Staff, Manager, Coordinator and VP Assistant is
  // routine and fully reversible — nothing happened in the meantime that
  // setting it back does not undo. Granting Admin, Vice President or Head of
  // Department is neither: the account can act on every report and every
  // account from that moment, and demoting it later does not un-do what it did.
  // Taking those roles away is equally worth a beat, since it silently removes
  // someone's ability to approve a budget.
  //
  // Confirming every change instead would be safer on paper and worse in
  // practice — a dialog you dismiss without reading protects nothing.
  const needsConfirmation = (next: AppRole) =>
    isPrivileged(next) || isPrivileged(role);

  const granting = pendingRole !== null && isPrivileged(pendingRole);
  const targetLabel = pendingRole ? roleLabel(pendingRole) : "";

  return (
    <>
      <ResponsiveSelect
        className="w-48"
        size="sm"
        aria-label="Role"
        value={role}
        disabled={disabled}
        onValueChange={(value) => {
          const next = value as AppRole;
          if (next === role) return;
          if (needsConfirmation(next)) {
            setPendingRole(next);
            setConfirming(true);
          } else {
            submit(next);
          }
        }}
        options={ASSIGNABLE_ROLES.filter(
          (option) => option !== "admin" || canGrantAdmin || role === "admin"
        ).map((option) => ({ value: option, label: roleLabel(option) }))}
      />

      {/* The Select is controlled by the `role` prop, which only changes once
          the server action revalidates. Cancelling therefore needs no explicit
          revert — the trigger never stopped showing the current role. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {granting
                ? `Make ${name} a ${targetLabel}?`
                : `Remove ${name}'s ${roleLabel(role)} access?`}
            </DialogTitle>
            <DialogDescription>
              {granting && pendingRole
                ? grantWarning(pendingRole)
                : `${name} becomes a ${targetLabel} and immediately loses their ${roleLabel(role)} powers — deciding on other people's reports, managing accounts, and setting the approved annual budget.`}
            </DialogDescription>
          </DialogHeader>
          <ActionMessage error={state && "error" in state ? state.error : null} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            {/* The dialog closes on click rather than waiting for the round
                trip: the change is optimistic in the honest sense — the row's
                select still shows the old role until the server confirms, and
                a failure surfaces as a toast. Holding a modal open over a
                sub-second request would be the slower, worse version. */}
            <ActionButton
              variant={granting ? "default" : "destructive"}
              pending={pending}
              pendingLabel="Saving…"
              onClick={() => {
                if (pendingRole) submit(pendingRole);
                setConfirming(false);
              }}
            >
              {granting ? `Make ${targetLabel}` : `Change to ${targetLabel}`}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    <ResponsiveSelect
      className="w-52"
      size="sm"
      aria-label="Department"
      value={department ?? UNASSIGNED}
      disabled={disabled}
      onValueChange={(next) => {
        const formData = new FormData();
        formData.set("user_id", userId);
        formData.set("department", next);
        formAction(formData);
      }}
      options={[
        { value: UNASSIGNED, label: "Unassigned" },
        ...departments.map((entry) => ({
          value: entry.id,
          label: entry.label,
        })),
      ]}
    />
  );
}

export function ResetPasswordButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    resetUserPassword,
    null
  );
  useActionToasts(state, (s) => {
    setConfirming(false);
    setTempPassword(s.tempPassword ?? null);
  });

  return (
    <>
      {/* This used to submit on click. It rotates a colleague's password the
          instant it fires and there is no undo — the old password is gone, and
          the only remedy is walking the new one over to them. One row's worth
          of mis-aim was enough to lock someone out of a live system, so the
          click now opens a question instead of doing the thing. */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setConfirming(true)}
        title="Reset password"
      >
        <KeyRound className="size-4" />
        Reset password
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {name}&apos;s password?</DialogTitle>
            <DialogDescription>
              Their current password stops working immediately, and cannot be
              recovered. You&apos;ll get a temporary one to hand to them — until
              you do, they cannot sign in.
            </DialogDescription>
          </DialogHeader>
          {/* Kept in the dialog rather than only in a toast. If the reset is
              refused — a Coordinator aiming at a privileged account — the
              refusal has to appear where the decision was made, not behind the
              modal that is still covering the screen. */}
          <ActionMessage error={state && "error" in state ? state.error : null} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="user_id" value={userId} />
              <ActionButton
                type="submit"
                variant="destructive"
                pending={pending}
                pendingLabel="Resetting…"
              >
                Reset password
              </ActionButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <ActionMessage error={state && "error" in state ? state.error : null} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="user_id" value={userId} />
              <ActionButton
                type="submit"
                variant="destructive"
                pending={pending}
                pendingLabel="Deleting…"
              >
                Delete user
              </ActionButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
