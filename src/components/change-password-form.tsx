"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import {
  changePassword,
  type ProfileActionState,
} from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToasts } from "@/components/use-action-toasts";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    ProfileActionState,
    FormData
  >(changePassword, null);
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
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
