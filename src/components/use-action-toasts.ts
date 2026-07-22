"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { UserActionState } from "@/app/(app)/admin/users/actions";

type SuccessState = Extract<NonNullable<UserActionState>, { success: string }>;

// Surfaces a server action's result once. useActionState keeps returning the
// same object on re-render, so the ref is what stops one save from toasting
// twice; `onSuccess` replaces the default toast when the caller needs to do
// something with the result instead, such as reveal a temporary password or
// close a dialog.
export function useActionToasts(
  state: UserActionState,
  onSuccess?: (state: SuccessState) => void
) {
  const seen = useRef<UserActionState>(null);
  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;
    if ("error" in state) toast.error(state.error);
    else if (onSuccess) onSuccess(state);
    else toast.success(state.success);
  }, [state, onSuccess]);
}
