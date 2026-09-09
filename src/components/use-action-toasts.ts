"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

// The two shapes a Server Action in this app returns, and which this hook knows
// how to say out loud.
//
// Generic over the state rather than named after one action's type. It was
// typed against the Users page's UserActionState, which meant the two other
// call sites — the project month form and the budget approval bar — had to
// launder their own perfectly valid state through `as never` to reach it. A
// cast at a call site to satisfy a hook is the hook's type being wrong, not the
// caller's.
//
// Actions may add fields to the success arm: the Users page returns a temporary
// password on it, and `onSuccess` still receives that concrete type.
export type ActionToastState = { error: string } | { success: string } | null;

export function useActionToasts<S extends ActionToastState>(
  state: S,
  onSuccess?: (state: Extract<NonNullable<S>, { success: string }>) => void
) {
  const seen = useRef<S | null>(null);
  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;

    // The one cast, here rather than at every call site: `in` does not narrow a
    // generic, and the constraint above has already established that the state
    // is one of these two.
    const result = state as { error: string } | { success: string };
    if ("error" in result) {
      toast.error(result.error);
    } else if (onSuccess) {
      onSuccess(state as Extract<NonNullable<S>, { success: string }>);
    } else {
      toast.success(result.success);
    }
  }, [state, onSuccess]);
}
