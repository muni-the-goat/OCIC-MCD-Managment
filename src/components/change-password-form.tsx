"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import {
  changePassword,
  type ProfileActionState,
} from "@/app/(app)/profile/actions";
import { ActionButton, ActionMessage } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToasts } from "@/components/use-action-toasts";
import { useSuccessFlash } from "@/components/use-success-flash";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    ProfileActionState,
    FormData
  >(changePassword, null);
  const succeeded = useSuccessFlash(state);
  // Clear the fields on success rather than leaving passwords sitting in the
  // inputs; the toast still confirms it worked.
  useActionToasts(state, (s) => {
    toast.success(s.success);
    formRef.current?.reset();
  });

  return (
    <form ref={formRef} action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">New password</Label>
        <Input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <ActionButton
          type="submit"
          pending={pending}
          success={succeeded}
          pendingLabel="Updating…"
          successLabel="Password updated"
        >
          Update password
        </ActionButton>
        {/* The three fields clear themselves on success, which on its own is
            ambiguous — an emptied form looks the same as a form that reset
            because something went wrong. This is what tells the two apart, and
            it is why the error is worth repeating here as well as in the
            toast: this is the spot the reader is already looking at. */}
        <ActionMessage error={state && "error" in state ? state.error : null} />
      </div>
    </form>
  );
}
