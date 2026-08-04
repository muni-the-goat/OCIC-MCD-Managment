"use client";

import { useFormStatus } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { LumaSpin } from "@/components/ui/luma-spin";

// The sign-in Server Action authenticates and then redirects, a round trip with
// no feedback until now. useFormStatus reports the parent form's pending state,
// which stays true for the whole action, so the button reads "Signing in…" and a
// full-screen overlay covers the wait through to the dashboard load.
export function LoginSubmit() {
  const { pending } = useFormStatus();

  return (
    <>
      {/* No success state: a successful sign-in redirects, so the only
          completion that matters is the dashboard arriving. */}
      <ActionButton
        type="submit"
        className="w-full"
        pending={pending}
        pendingLabel="Signing in…"
      >
        Sign in
      </ActionButton>
      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            <LumaSpin />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
